import { inject, Service } from '@angular/core';

import { KolssApiClient, KolssApiError } from '@core/api/generated/kolss-api.client';
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
  ): Promise<void> {
    await this.api.updateLead(lead.id, lead.version ?? 1, {
      name: update.name,
      phone: update.phone,
      email: update.email,
      cityRegion: lead.cityRegion,
      productInterest: lead.productInterest,
      estimatedBudget: lead.estimatedBudget,
      estimatedBudgetCurrency: lead.estimatedBudgetCurrency,
      initialMessage: lead.initialMessage,
      assignedToId: update.managerId,
      channel: update.channel,
      editedFields: [...editedFields],
    });
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
}
