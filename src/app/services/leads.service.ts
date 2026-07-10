import { inject, Injectable } from '@angular/core';

import { AuthService } from '../core/auth/auth.service';
import { injectSupabase } from '../core/supabase/supabase.service';
import { validateCloseLead } from './crm-mock.helpers';
import type { CloseLeadPayload, CloseReason, LeadSource, MockLead } from './crm-mock.types';
import {
  LEAD_LIST_SELECT,
  mapCreateLeadSource,
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

  async createLead(payload: CreateLeadPayload): Promise<MockLead> {
    const now = new Date().toISOString();
    const actorId = this.currentUserId();
    const { source_system, source_channel } = mapCreateLeadSource(payload.source);
    const externalLeadId = `crm:${crypto.randomUUID()}`;

    const { data, error } = await this.supabase
      .from('leads')
      .insert({
        office_id: payload.officeId,
        source_system,
        source_channel,
        external_lead_id: externalLeadId,
        lead_status: 'new',
        workflow_status: 'new',
        workflow_status_changed_at: now,
        source_created_at: now,
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        city_region: payload.cityRegion || null,
        product_interest: payload.productInterest || null,
        estimated_budget: payload.estimatedBudget,
        order_comment: payload.initialMessage || null,
      })
      .select(LEAD_LIST_SELECT)
      .single();

    if (error) throw error;
    if (!data) throw new Error('error.leadCreateFailed');

    const { error: eventError } = await this.supabase.from('lead_events').insert({
      lead_id: data.id,
      actor_id: actorId,
      event_type: 'created',
      comment: null,
      old_value: null,
      new_value: {
        source: payload.source,
        source_system,
        source_channel,
        workflow_status: 'new',
      },
    });
    if (eventError) throw eventError;

    return mapLeadListRow(data as LeadListRow);
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

  async deleteLead(leadId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error('error.leadDeleteFailed');
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
    if (!data) throw new Error('error.historyNotFound');

    const current = data as EditableLeadEventRow;
    const nextComment = payload.comment.trim();
    const changedFields = [
      ...(current.comment?.trim() !== nextComment ? ['message'] : []),
      ...(current.event_type !== payload.eventType ? ['type'] : []),
    ];
    if (!changedFields.length) {
      throw new Error('error.nothingChanged');
    }

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

    const { data: updatedEvent, error: updateError } = await this.supabase
      .from('lead_events')
      .update({
        event_type: payload.eventType,
        comment: nextComment,
        new_value: nextValue,
      })
      .eq('id', eventId)
      .eq('lead_id', leadId)
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedEvent) {
      throw new Error('error.historySaveFailed');
    }

    if (this.isCloseEventType(current.event_type) || this.isCloseEventType(payload.eventType)) {
      await this.syncLeadCloseFields(leadId, payload.eventType, nextComment, nextValue, now);
    }

    return changedFields;
  }

  async updateCloseDetails(leadId: string, payload: CloseLeadPayload): Promise<string | null> {
    const validationError = validateCloseLead(payload);
    if (validationError) return validationError;

    const reasonError = await this.ensureLossReasonExists(payload.reason);
    if (reasonError) return reasonError;

    const { data: lead, error: leadError } = await this.supabase
      .from('leads')
      .select('workflow_status, loss_reason, last_comment')
      .eq('id', leadId)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) return 'error.leadNotFound';
    if (lead.workflow_status !== 'closed') return 'error.leadNotClosed';

    const userComment = payload.comment.trim();
    const nextComment = userComment || null;
    const changedFields = [
      ...(lead.loss_reason !== payload.reason ? ['closeReason'] : []),
      ...((lead.last_comment ?? '') !== (nextComment ?? '') ? ['message'] : []),
    ];
    if (!changedFields.length) return 'error.nothingChanged';

    const now = new Date().toISOString();
    const { error: updateLeadError } = await this.supabase
      .from('leads')
      .update({
        loss_reason: payload.reason,
        last_comment: nextComment,
        updated_at: now,
      })
      .eq('id', leadId);
    if (updateLeadError) throw updateLeadError;

    const { data: closeEvent, error: eventError } = await this.supabase
      .from('lead_events')
      .select('id, new_value')
      .eq('lead_id', leadId)
      .in('event_type', ['closed', 'bad_lead'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eventError) throw eventError;

    const closeEventComment = userComment || null;
    const nextValue = {
      reason: payload.reason,
      workflow_status: 'closed',
    };

    if (closeEvent) {
      const { data: updatedEvent, error: updateEventError } = await this.supabase
        .from('lead_events')
        .update({
          comment: closeEventComment,
          new_value: {
            ...this.toEditableRecord(closeEvent.new_value),
            ...nextValue,
          },
        })
        .eq('id', closeEvent.id)
        .eq('lead_id', leadId)
        .select('id')
        .maybeSingle();
      if (updateEventError) throw updateEventError;
      if (!updatedEvent) {
        throw new Error('error.historySaveFailed');
      }
    } else {
      const { error: insertEventError } = await this.supabase.from('lead_events').insert({
        lead_id: leadId,
        actor_id: this.currentUserId(),
        event_type: 'closed',
        comment: closeEventComment,
        old_value: null,
        new_value: nextValue,
      });
      if (insertEventError) throw insertEventError;
    }

    await this.insertLeadEditAudit(leadId, changedFields, now);
    return null;
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
    if (!userId) throw new Error('error.authRequired');
    return userId;
  }

  async ensureLossReasonExists(reason: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('loss_reasons')
      .select('code')
      .eq('code', reason)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return `error.lossReasonMissing:${reason}`;
    }
    return null;
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
      comment: null,
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
    return context?.profile.display_name?.trim() || context?.user.email || 'common.unknown';
  }

  private toEditableRecord(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return { ...(value as Record<string, unknown>) };
    }
    return value == null ? {} : { value };
  }

  private isCloseEventType(eventType: string): boolean {
    return eventType === 'closed' || eventType === 'bad_lead';
  }

  private async syncLeadCloseFields(
    leadId: string,
    eventType: string,
    comment: string,
    eventValue: Record<string, unknown>,
    updatedAt: string,
  ): Promise<void> {
    if (!this.isCloseEventType(eventType)) return;

    const { data: lead, error: leadError } = await this.supabase
      .from('leads')
      .select('loss_reason, last_comment')
      .eq('id', leadId)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) return;

    const reason = this.closeReasonFromValue(eventValue);
    const nextComment = comment || null;
    const leadUpdates: Record<string, string | null> = { updated_at: updatedAt };
    let hasChanges = false;

    if (reason && lead.loss_reason !== reason) {
      leadUpdates['loss_reason'] = reason;
      hasChanges = true;
    }
    if ((lead.last_comment ?? '') !== nextComment) {
      leadUpdates['last_comment'] = nextComment;
      hasChanges = true;
    }
    if (!hasChanges) return;

    const { error } = await this.supabase.from('leads').update(leadUpdates).eq('id', leadId);
    if (error) throw error;
  }

  private closeReasonFromValue(value: Record<string, unknown>): CloseReason | null {
    const reason = value['reason'];
    if (typeof reason !== 'string' || !reason.trim()) return null;
    return reason.trim();
  }
}
