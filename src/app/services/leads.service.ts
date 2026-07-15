import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import { AuthService } from '../core/auth/auth.service';
import { validateCloseLead } from './crm-mock.helpers';
import type { CloseLeadPayload, LeadSource, MockLead } from './crm-mock.types';
import { mapLeadDetail, mapLeadListRow, type LeadListRow } from './leads.mapper';

export interface LeadsListFilters {
  officeId?: string | null;
  assignedTo?: string | null;
  search?: string | null;
  source?: string | null;
  workflow?: string | null;
  archived?: 'active' | 'only' | 'all';
  days?: number | null;
  limit?: number;
}

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
  readonly eventType: string;
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
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly api = inject(KolssApiClient);
  private readonly auth = inject(AuthService);

  async list(filters: LeadsListFilters = {}): Promise<readonly MockLead[]> {
    const requested = Math.max(1, filters.limit ?? 500);
    const rows: LeadListRow[] = [];
    let cursor = '';
    do {
      const page = await this.api.listLeads({
        officeId: filters.officeId,
        assignedTo: filters.assignedTo,
        search: filters.search,
        source: filters.source,
        workflow: filters.workflow,
        archived: filters.archived === 'active' ? undefined : filters.archived,
        days: filters.days ?? undefined,
        cursor,
        limit: Math.min(100, requested - rows.length),
      });
      rows.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor && rows.length < requested);
    return rows.slice(0, requested).map(mapLeadListRow);
  }

  async getById(leadId: string): Promise<MockLead | null> {
    try {
      const result = await this.api.lead(leadId);
      return mapLeadDetail(result.lead, result.relations);
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      throw error;
    }
  }

  async listAssignedTo(userId: string, limit = 50): Promise<readonly MockLead[]> {
    return this.list({ assignedTo: userId, limit });
  }

  async createLead(payload: CreateLeadPayload): Promise<MockLead> {
    const row = await this.api.createLead<LeadListRow>(payload);
    return mapLeadListRow(row);
  }

  async updateLeadDetails(
    leadId: string,
    payload: LeadDetailsUpdate,
    editedFields: readonly string[],
  ): Promise<void> {
    const current = await this.api.lead(leadId);
    await this.api.updateLead(leadId, current.lead.version ?? 1, {
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

  async updateCloseDetails(leadId: string, payload: CloseLeadPayload): Promise<string | null> {
    const validationError = validateCloseLead(payload);
    if (validationError) return validationError;
    const reasonError = await this.ensureLossReasonExists(payload.reason);
    if (reasonError) return reasonError;
    await this.api.leadAction(leadId, 'close', payload);
    return null;
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
