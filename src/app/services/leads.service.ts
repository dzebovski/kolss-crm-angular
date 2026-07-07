import { inject, Injectable } from '@angular/core';

import { AuthService } from '../core/auth/auth.service';
import { injectSupabase } from '../core/supabase/supabase.service';
import type { MockLead } from './crm-mock.types';
import {
  LEAD_LIST_SELECT,
  mapLeadDetail,
  mapLeadListRow,
  type ContactAttemptRow,
  type ContractRow,
  type LeadEventRow,
  type LeadListRow,
  type ShowroomVisitRow,
} from './leads.mapper';

export interface LeadsListFilters {
  officeId?: string | null;
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

interface EditableLeadEventRow {
  readonly event_type: string;
  readonly comment: string | null;
  readonly new_value: unknown;
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly supabase = injectSupabase();
  private readonly auth = inject(AuthService);

  async list(filters: LeadsListFilters = {}): Promise<readonly MockLead[]> {
    const limit = filters.limit ?? 500;
    let query = this.supabase
      .from('leads')
      .select(LEAD_LIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filters.officeId) {
      query = query.eq('office_id', filters.officeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as LeadListRow[]).map(mapLeadListRow);
  }

  async getById(leadId: string): Promise<MockLead | null> {
    const { data, error } = await this.supabase
      .from('leads')
      .select(LEAD_LIST_SELECT)
      .eq('id', leadId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const relations = await this.loadRelations(leadId);
    return mapLeadDetail(data as LeadListRow, relations);
  }

  async listAssignedTo(userId: string, limit = 50): Promise<readonly MockLead[]> {
    const { data, error } = await this.supabase
      .from('leads')
      .select(LEAD_LIST_SELECT)
      .eq('assigned_to', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as LeadListRow[]).map(mapLeadListRow);
  }

  async updateLeadDetails(
    leadId: string,
    payload: LeadDetailsUpdate,
    editedFields: readonly string[],
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('leads')
      .update({
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        city_region: payload.cityRegion,
        product_interest: payload.productInterest,
        estimated_budget: payload.estimatedBudget,
        order_comment: payload.initialMessage,
        assigned_to: payload.assignedToId,
        updated_at: now,
      })
      .eq('id', leadId);
    if (error) throw error;

    if (editedFields.length) {
      await this.insertLeadEditAudit(leadId, editedFields, now);
    }
  }

  async updateHistoryEvent(
    leadId: string,
    eventId: string,
    payload: HistoryEventUpdate,
  ): Promise<readonly string[]> {
    const { data, error: loadError } = await this.supabase
      .from('lead_events')
      .select('event_type, comment, new_value')
      .eq('id', eventId)
      .eq('lead_id', leadId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!data) throw new Error('Подію історії не знайдено.');

    const current = data as EditableLeadEventRow;
    const nextComment = payload.comment.trim();
    const changedFields = [
      ...(current.comment?.trim() !== nextComment ? ['повідомлення'] : []),
      ...(current.event_type !== payload.eventType ? ['тип'] : []),
    ];
    if (!changedFields.length) return changedFields;

    const now = new Date().toISOString();
    const nextValue = {
      ...this.toEditableRecord(current.new_value),
      edit_audit: {
        fields: changedFields,
        edited_at: now,
        edited_by: this.currentUserId(),
        edited_by_name: this.currentActorName(),
      },
    };

    const { error: updateError } = await this.supabase
      .from('lead_events')
      .update({
        event_type: payload.eventType,
        comment: nextComment,
        new_value: nextValue,
      })
      .eq('id', eventId)
      .eq('lead_id', leadId);
    if (updateError) throw updateError;
    return changedFields;
  }

  private async loadRelations(leadId: string) {
    const [contactAttempts, showroomVisits, contracts, events] = await Promise.all([
      this.fetchContactAttempts(leadId),
      this.fetchShowroomVisits(leadId),
      this.fetchContracts(leadId),
      this.fetchEvents(leadId),
    ]);

    return { contactAttempts, showroomVisits, contracts, events };
  }

  private async fetchContactAttempts(leadId: string): Promise<readonly ContactAttemptRow[]> {
    const { data, error } = await this.supabase
      .from('lead_contact_attempts')
      .select('*, profiles(display_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ContactAttemptRow[];
  }

  private async fetchShowroomVisits(leadId: string): Promise<readonly ShowroomVisitRow[]> {
    const { data, error } = await this.supabase
      .from('lead_showroom_visits')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ShowroomVisitRow[];
  }

  private async fetchContracts(leadId: string): Promise<readonly ContractRow[]> {
    const { data, error } = await this.supabase
      .from('lead_contracts')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ContractRow[];
  }

  private async fetchEvents(leadId: string): Promise<readonly LeadEventRow[]> {
    const { data, error } = await this.supabase
      .from('lead_events')
      .select('*, profiles(display_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as LeadEventRow[];
  }

  currentUserId(): string {
    const userId = this.auth.sessionContext()?.user.id;
    if (!userId) throw new Error('Користувач не автентифікований');
    return userId;
  }

  private async insertLeadEditAudit(
    leadId: string,
    editedFields: readonly string[],
    editedAt: string,
  ): Promise<void> {
    const actorId = this.currentUserId();
    const actorName = this.currentActorName();
    const { error } = await this.supabase.from('lead_events').insert({
      lead_id: leadId,
      actor_id: actorId,
      event_type: 'lead_updated',
      comment: `Дані ліда відредаговано: ${editedFields.join(', ')}. Редагував: ${actorName}.`,
      old_value: null,
      new_value: {
        edit_audit: {
          fields: editedFields,
          edited_at: editedAt,
          edited_by: actorId,
          edited_by_name: actorName,
        },
      },
    });
    if (error) throw error;
  }

  private currentActorName(): string {
    const context = this.auth.sessionContext();
    return context?.profile.display_name?.trim() || context?.user.email || 'Невідомий';
  }

  private toEditableRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }
    return value == null ? {} : { value };
  }
}
