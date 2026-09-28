import { inject, Service } from '@angular/core';

import { KolssApiClient, KolssApiError } from '@core/api/generated/kolss-api.client';
import type {
  LeadRating,
  LossReason,
  RatingActivityRequest,
  UpdateLeadInfoRequest,
  V2StatusActivityRequest,
} from '@core/api/generated/kolss-api.types';
import type { LeadReminderKind } from '@domain/lead.rules';
import type { Lead } from '@domain/lead.types';
import { v2LeadColumnsFromRow } from '@domain/v2/lead-card.mapper';
import type { V2LeadColumns } from '@domain/v2/lead-card.types';
import type { V2LeadChannel } from '@domain/v2/lead-view.types';
import { LeadActivitiesService } from '@services/lead-activities.service';
import { mapLeadDetail } from '@services/leads.mapper';
import { LeadsService } from '@services/leads.service';

/** A loaded lead: the shared v1 model plus the v2 columns the v1 model doesn't carry. */
export interface V2LoadedLead {
  readonly lead: Lead;
  readonly columns: V2LeadColumns;
}

/** Edit contact info (lead card v1.3): the fields the popup changes. */
export interface V2ContactUpdate {
  readonly name: string;
  /** Normalized for the lead's office. */
  readonly phone: string;
  readonly email: string | null;
  readonly managerId: string | null;
  readonly channel: V2LeadChannel;
}

/** The three persisted parts of Successful call, deliberately ordered for lead-version safety. */
export interface V2SuccessfulCallUpdate {
  readonly info: UpdateLeadInfoRequest;
  readonly rating: LeadRating | null;
  readonly status: Omit<V2StatusActivityRequest, 'type'>;
}

export interface V2EditContactUpdate {
  readonly contact: V2ContactUpdate;
  readonly editedFields: readonly V2ContactField[];
  readonly info: UpdateLeadInfoRequest;
}

export class V2EditContactPartialWriteError extends Error {
  constructor(cause: unknown) {
    super('v2.editContact.partialSave');
    this.name = 'V2EditContactPartialWriteError';
    this.cause = cause;
  }
}

/** An earlier request succeeded, so closing the dialog would hide a partial saved result. */
export class V2SuccessfulCallPartialWriteError extends Error {
  constructor(
    readonly completed: 'info' | 'rating',
    cause: unknown,
  ) {
    super('v2.popup.success.partialSave');
    this.name = 'V2SuccessfulCallPartialWriteError';
    this.cause = cause;
  }
}

/** Audit keys of `lead_edited` (`core/i18n/field-keys.ts`), for the fields the popup changes. */
export type V2ContactField = 'name' | 'phone' | 'email' | 'manager' | 'channel';

/**
 * Data access for the v2 lead card. Reads `GET /v1/leads/{id}` once and maps it to the shared
 * v1 `Lead` (reusing `mapLeadDetail`) plus the v2 columns. Writes go through the existing
 * endpoints; nothing here changes v1 behaviour.
 */
@Service()
export class V2LeadCardService {
  private readonly api = inject(KolssApiClient);
  private readonly activities = inject(LeadActivitiesService);
  private readonly leads = inject(LeadsService);

  /** Reasons enabled for the v2 Lost popup; the database controls the offered codes. */
  async listV2LossReasons(): Promise<readonly LossReason[]> {
    const result = await this.api.lossReasons<LossReason>();
    return result.items.filter((reason) => reason.is_v2);
  }

  /** Null when the lead doesn't exist (404). */
  async load(leadId: string): Promise<V2LoadedLead | null> {
    try {
      const result = await this.api.lead(leadId);
      return {
        lead: mapLeadDetail(result.lead, result.relations),
        columns: v2LeadColumnsFromRow(result.lead),
      };
    } catch (error) {
      if (error instanceof KolssApiError && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * `PATCH /v1/leads/{id}` replaces every editable column, so the fields the popup doesn't
   * show are sent back unchanged from the loaded lead (as the v1 edit dialog does).
   */
  async updateContact(
    lead: Lead,
    update: V2ContactUpdate,
    editedFields: readonly V2ContactField[],
  ): Promise<number> {
    const result = await this.api.updateLead(lead.id, lead.version ?? 1, {
      name: update.name,
      phone: update.phone,
      email: update.email,
      cityRegion: lead.cityRegion,
      productInterest: lead.productInterest,
      estimatedBudget: lead.estimatedBudget,
      estimatedBudgetCurrency: lead.estimatedBudgetCurrency,
      initialMessage: lead.initialMessage,
      assignedToId: assignedToIdForUpdate(update.managerId, editedFields),
      channel: update.channel,
      editedFields: [...editedFields],
    });
    return result.version;
  }

  /**
   * C7 spans the full lead edit and partial v2 info endpoints. Contact goes first and returns
   * the next optimistic-lock version; the info patch then uses that version. A partial save is
   * surfaced explicitly so the stale dialog is never submitted again as if nothing changed.
   */
  async editContactAndRequest(lead: Lead, update: V2EditContactUpdate): Promise<void> {
    let version = lead.version ?? 1;
    let contactSaved = false;
    if (update.editedFields.length) {
      version = await this.updateContact(lead, update.contact, update.editedFields);
      contactSaved = true;
    }
    if (!Object.keys(update.info).length) return;
    try {
      await this.api.updateLeadInfo(lead.id, version, update.info);
    } catch (error) {
      if (contactSaved) throw new V2EditContactPartialWriteError(error);
      throw error;
    }
  }

  /** Reminders & tasks "Mark as done": clears the reminder as v1 does (`clear_reminder`). */
  completeReminder(leadId: string, kind: LeadReminderKind): Promise<void> {
    return this.activities.clearReminder(leadId, kind);
  }

  /** Timeline entry text edit (D6, as v1). */
  async updateEntry(leadId: string, eventId: string, comment: string): Promise<void> {
    await this.leads.updateHistoryEvent(leadId, eventId, { comment });
  }

  /** Timeline entry delete (D6, as v1). */
  deleteEntry(leadId: string, eventId: string): Promise<void> {
    return this.leads.deleteHistoryEvent(leadId, eventId);
  }

  /** English translation of an entry's text (D6, as v1). */
  async translateEntry(leadId: string, eventId: string): Promise<void> {
    await this.leads.translateHistoryEvent(leadId, eventId);
  }

  /** Call result or lead status popup (`v2_status` activity, contract §3.2). */
  async recordStatus(
    leadId: string,
    request: Omit<V2StatusActivityRequest, 'type'>,
  ): Promise<void> {
    await this.api.leadActivity(leadId, { type: 'v2_status', ...request });
  }

  /**
   * Successful call has three distinct API mutations. `updateLeadInfo` must run first because it
   * uses the loaded lead version; activities increment that version. The terminal call result is
   * intentionally last, so a failure cannot leave a lead marked Successful before its data saves.
   */
  async recordSuccessfulCall(lead: Lead, update: V2SuccessfulCallUpdate): Promise<void> {
    let completed: 'info' | 'rating' | null = null;
    try {
      if (Object.keys(update.info).length > 0) {
        await this.updateLeadInfo(lead, update.info);
        completed = 'info';
      }
      if (update.rating) {
        await this.setRating(lead.id, update.rating);
        completed = 'rating';
      }
      await this.recordStatus(lead.id, update.status);
    } catch (error) {
      if (completed) throw new V2SuccessfulCallPartialWriteError(completed, error);
      throw error;
    }
  }

  /** RatingSwitch: one click, no popup (`rating` activity). */
  async setRating(leadId: string, rating: LeadRating): Promise<void> {
    const request: RatingActivityRequest = { type: 'rating', rating };
    await this.api.leadActivity(leadId, request);
  }

  /** Add-comment popup: a note, personal reminder, or task assigned to an office colleague. */
  async addComment(
    leadId: string,
    comment: string,
    dueAt: string | null,
    assignedTo: string | null,
  ): Promise<void> {
    await this.api.leadActivity(leadId, {
      type: 'comment',
      comment: comment.trim(),
      ...(dueAt ? { dueAt } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    });
  }

  /** Lead info popup (`PATCH /v1/leads/{id}/info`, W7): only the sent fields change. */
  async updateLeadInfo(lead: Lead, request: UpdateLeadInfoRequest): Promise<void> {
    await this.api.updateLeadInfo(lead.id, lead.version ?? 1, request);
  }

  /** Reopen a lost lead (v1 `reopen` activity): back to New, call status and reminders cleared. */
  async reopen(leadId: string): Promise<void> {
    await this.api.leadActivity(leadId, { type: 'reopen' });
  }
}

/**
 * Maps the dialog's "Unassigned" pick to the wire value `PATCH /v1/leads/{id}` expects (2.27.0,
 * task G4/D9): for a non-super-admin actor, an omitted/`null` `assignedToId` now *keeps* the
 * current manager instead of clearing it, so an explicit clear must be sent as `""`. Only the
 * "manager" field being in `editedFields` means the user actually picked "Unassigned"; otherwise
 * `managerId` is just the lead's unchanged current value (already `null` when it has no
 * manager), which is safe to resend as-is for every actor, super admin included.
 */
function assignedToIdForUpdate(
  managerId: string | null,
  editedFields: readonly V2ContactField[],
): string | null {
  return editedFields.includes('manager') && managerId === null ? '' : managerId;
}
