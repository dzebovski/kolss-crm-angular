import { inject, Injectable } from '@angular/core';

import { KolssApiClient, KolssApiError } from '@core/api/generated/kolss-api.client';
import type { LeadEventTranslationResponse } from '@core/api/generated/kolss-api.types';
import { AuthService } from '@core/auth/auth.service';
import type { LeadMarker, LeadMarkerKind, LeadSource, Lead } from '@domain/lead.types';
import { mapLeadDetail, mapLeadListRow, mapLeadMarker, type LeadListRow } from './leads.mapper';

export interface LeadsListFilters {
  officeId?: string | null;
  assignedTo?: string | null;
  search?: string | null;
  source?: string | null;
  callStatus?: readonly string[] | null;
  clientStatus?: readonly string[] | null;
  archived?: 'active' | 'only' | 'all';
  days?: number | null;
  /**
   * Caps the result at this many rows. Omit to fetch the **complete** result
   * set: `list()` pages through the cursor (100 rows/request) until the API
   * reports no `nextCursor`, so every caller either gets everything or
   * explicitly asked for less — never a silent partial list.
   */
  limit?: number;
}

/**
 * Safety net for an unbounded `list()` call (no `limit` given), not a normal
 * operating limit. Measured production volume is in the low hundreds of
 * active leads per office; this is far above that. Hitting it means the
 * cursor loop isn't terminating as expected, so it fails loudly instead of
 * returning a silently truncated list.
 */
const UNBOUNDED_FETCH_SAFETY_LIMIT = 5000;

export interface LeadDetailsUpdate {
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly cityRegion: string;
  readonly productInterest: string;
  readonly estimatedBudget: number | null;
  readonly initialMessage: string;
  readonly assignedToId: string | null;
}

export interface HistoryEventUpdate {
  readonly comment: string;
}

export interface CreateLeadPayload {
  readonly officeId: string;
  readonly source: LeadSource;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly cityRegion: string;
  readonly productInterest: string;
  readonly estimatedBudget: number | null;
  readonly initialMessage: string;
  readonly sourceCreatedAtLocal: string;
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly api = inject(KolssApiClient);
  private readonly auth = inject(AuthService);

  async list(filters: LeadsListFilters = {}): Promise<readonly Lead[]> {
    const requested = filters.limit != null ? Math.max(1, filters.limit) : null;
    const rows: LeadListRow[] = [];
    let cursor = '';
    do {
      const page = await this.api.listLeads({
        officeId: filters.officeId,
        assignedTo: filters.assignedTo,
        search: filters.search,
        source: filters.source,
        callStatus: filters.callStatus,
        clientStatus: filters.clientStatus,
        archived: filters.archived === 'active' ? undefined : filters.archived,
        days: filters.days ?? undefined,
        cursor,
        limit: requested != null ? Math.min(100, requested - rows.length) : 100,
      });
      rows.push(...page.items);
      cursor = page.nextCursor;
      if (requested == null && rows.length > UNBOUNDED_FETCH_SAFETY_LIMIT) {
        throw new Error(
          `LeadsService.list() exceeded the ${UNBOUNDED_FETCH_SAFETY_LIMIT}-row safety limit for an unbounded fetch.`,
        );
      }
    } while (cursor && (requested == null || rows.length < requested));
    return (requested == null ? rows : rows.slice(0, requested)).map(mapLeadListRow);
  }

  async getById(leadId: string): Promise<Lead | null> {
    try {
      const result = await this.api.lead(leadId);
      return mapLeadDetail(result.lead, result.relations);
    } catch (error) {
      if (error instanceof KolssApiError && error.status === 404) return null;
      throw error;
    }
  }

  async listAssignedTo(userId: string, limit = 50): Promise<readonly Lead[]> {
    return this.list({ assignedTo: userId, limit });
  }

  async createLead(payload: CreateLeadPayload): Promise<Lead> {
    const row = await this.api.createLead<LeadListRow>(payload);
    return mapLeadListRow(row);
  }

  /**
   * `version` must come from the lead the caller already has loaded (it is
   * used as the `If-Match` optimistic-concurrency token). Fetching it here
   * via an extra GET would both waste a request and reopen the exact
   * read-modify-write race optimistic concurrency exists to prevent.
   */
  async updateLeadDetails(
    leadId: string,
    version: number,
    payload: LeadDetailsUpdate,
    editedFields: readonly string[],
  ): Promise<void> {
    await this.api.updateLead(leadId, version, {
      ...payload,
      editedFields: [...editedFields],
    });
  }

  async archiveLead(leadId: string): Promise<void> {
    await this.api.archiveLead(leadId);
  }

  async restoreLead(leadId: string): Promise<void> {
    await this.api.restoreLead(leadId);
  }

  async deleteLeadPermanently(leadId: string): Promise<void> {
    await this.api.deleteLead(leadId);
  }

  async updateHistoryEvent(
    leadId: string,
    eventId: string,
    payload: HistoryEventUpdate,
  ): Promise<readonly string[]> {
    const result = await this.api.updateEvent(leadId, eventId, payload);
    return result.changedFields;
  }

  async deleteHistoryEvent(leadId: string, eventId: string): Promise<void> {
    await this.api.deleteEvent(leadId, eventId);
  }

  translateHistoryEvent(leadId: string, eventId: string): Promise<LeadEventTranslationResponse> {
    return this.api.translateEvent(leadId, eventId);
  }

  async setMarker(leadId: string, kind: LeadMarkerKind): Promise<LeadMarker> {
    const marker = mapLeadMarker(await this.api.setLeadMarker(leadId, kind));
    if (!marker) throw new Error('Не вдалося прочитати збережену позначку.');
    return marker;
  }

  async deleteMarker(leadId: string, kind: LeadMarkerKind): Promise<void> {
    await this.api.deleteLeadMarker(leadId, kind);
  }

  currentUserId(): string {
    const userId = this.auth.sessionContext()?.user.id;
    if (!userId) throw new Error('error.authRequired');
    return userId;
  }

  async ensureLossReasonExists(reason: string): Promise<string | null> {
    const result = await this.api.lossReasons<{ readonly code: string }>();
    return result.items.some((item) => item.code === reason)
      ? null
      : `error.lossReasonMissing:${reason}`;
  }
}
