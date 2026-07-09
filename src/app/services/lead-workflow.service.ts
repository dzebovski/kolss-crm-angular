import { inject, Injectable } from '@angular/core';

import { injectSupabase } from '../core/supabase/supabase.service';
import type { CloseLeadPayload, SuccessfulLeadPayload } from './crm-mock.types';
import { CLOSE_REASON_LABELS, validateCloseLead, validateSuccessfulLead } from './crm-mock.helpers';
import { LeadsService } from './leads.service';

@Injectable({ providedIn: 'root' })
export class LeadWorkflowService {
  private readonly supabase = injectSupabase();
  private readonly leads = inject(LeadsService);

  async takeLead(leadId: string): Promise<void> {
    const actorId = this.leads.currentUserId();
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('leads')
      .update({
        workflow_status: 'taken',
        lead_status: 'in_progress',
        assigned_to: actorId,
        workflow_status_changed_at: now,
        lead_status_changed_at: now,
      })
      .eq('id', leadId);

    if (error) throw error;
    await this.insertEvent(leadId, actorId, 'taken', 'Лід взято в роботу', {
      workflow_status: 'new',
    }, {
      workflow_status: 'taken',
    });
  }

  async recordFirstCall(leadId: string, result: string, comment: string): Promise<string | null> {
    if (!result.trim()) return 'Оберіть результат першого дзвінка.';
    if (!comment.trim()) return 'Додайте короткий коментар до дзвінка.';

    const actorId = this.leads.currentUserId();
    const mappedResult = mapFirstCallResult(result);

    const { error: insertError } = await this.supabase.from('lead_contact_attempts').insert({
      lead_id: leadId,
      manager_id: actorId,
      result: mappedResult,
      comment: comment.trim(),
    });
    if (insertError) throw insertError;

    await this.updateWorkflow(leadId, 'first_call_done', {
      lead_status: 'in_progress',
      callback_due_at: mappedResult === 'reached' ? null : undefined,
    });

    await this.insertEvent(leadId, actorId, 'contact_attempt', comment.trim(), null, {
      result: mappedResult,
      workflow_status: 'first_call_done',
    });
    return null;
  }

  async scheduleVisit(leadId: string, scheduledAt: string, comment: string): Promise<string | null> {
    if (!scheduledAt.trim()) return 'Вкажіть дату візиту.';
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return 'Некоректна дата візиту.';

    const actorId = this.leads.currentUserId();
    const { error } = await this.supabase.from('lead_showroom_visits').insert({
      lead_id: leadId,
      scheduled_at: when.toISOString(),
      status: 'scheduled',
      comment: comment.trim() || null,
      created_by: actorId,
    });
    if (error) throw error;

    await this.updateWorkflow(leadId, 'visit_scheduled', { callback_due_at: null });
    await this.insertEvent(leadId, actorId, 'showroom_visit_scheduled', comment.trim() || null, null, {
      scheduled_at: when.toISOString(),
      workflow_status: 'visit_scheduled',
    });
    return null;
  }

  async rescheduleVisit(
    leadId: string,
    scheduledAt: string,
    comment: string,
  ): Promise<string | null> {
    if (!scheduledAt.trim()) return 'Вкажіть нову дату візиту.';
    if (!comment.trim()) return 'Вкажіть причину або коментар до перенесення.';
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return 'Некоректна дата візиту.';

    const actorId = this.leads.currentUserId();
    const { data: latestVisit } = await this.supabase
      .from('lead_showroom_visits')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVisit?.id) {
      await this.supabase
        .from('lead_showroom_visits')
        .update({ status: 'rescheduled' })
        .eq('id', latestVisit.id);
    }

    const { error } = await this.supabase.from('lead_showroom_visits').insert({
      lead_id: leadId,
      scheduled_at: when.toISOString(),
      status: 'scheduled',
      comment: comment.trim(),
      created_by: actorId,
    });
    if (error) throw error;

    await this.updateWorkflow(leadId, 'visit_rescheduled');
    await this.insertEvent(leadId, actorId, 'visit_rescheduled', comment.trim(), null, {
      scheduled_at: when.toISOString(),
      workflow_status: 'visit_rescheduled',
    });
    return null;
  }

  async completeVisit(leadId: string, comment: string): Promise<string | null> {
    if (!comment.trim()) return 'Додайте короткий результат візиту.';

    const actorId = this.leads.currentUserId();
    const { data: latestVisit } = await this.supabase
      .from('lead_showroom_visits')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestVisit?.id) {
      await this.supabase
        .from('lead_showroom_visits')
        .update({ status: 'visited' })
        .eq('id', latestVisit.id);
    }

    await this.updateWorkflow(leadId, 'visit_completed');
    await this.insertEvent(leadId, actorId, 'showroom_visit_completed', comment.trim(), null, {
      workflow_status: 'visit_completed',
    });
    return null;
  }

  async addComment(leadId: string, comment: string): Promise<string | null> {
    if (!comment.trim()) return 'Коментар не може бути порожнім.';

    const actorId = this.leads.currentUserId();
    const { data: lead, error: leadError } = await this.supabase
      .from('leads')
      .select('lead_status')
      .eq('id', leadId)
      .single();
    if (leadError) throw leadError;

    const { error } = await this.supabase.from('lead_comments').insert({
      lead_id: leadId,
      author_id: actorId,
      lead_status: lead.lead_status,
      body: comment.trim(),
    });
    if (error) throw error;

    await this.supabase.from('leads').update({ last_comment: comment.trim() }).eq('id', leadId);
    await this.insertEvent(leadId, actorId, 'comment', comment.trim());
    return null;
  }

  async closeLead(leadId: string, payload: CloseLeadPayload): Promise<string | null> {
    const error = validateCloseLead(payload);
    if (error) return error;

    const reasonError = await this.leads.ensureLossReasonExists(payload.reason);
    if (reasonError) return reasonError;

    const actorId = this.leads.currentUserId();
    const now = new Date().toISOString();
    const { error: updateError } = await this.supabase
      .from('leads')
      .update({
        workflow_status: 'closed',
        lead_status: 'failed',
        loss_reason: payload.reason,
        workflow_status_changed_at: now,
        lead_status_changed_at: now,
        callback_due_at: null,
        last_comment: payload.comment || CLOSE_REASON_LABELS[payload.reason],
      })
      .eq('id', leadId);
    if (updateError) throw updateError;

    await this.insertEvent(
      leadId,
      actorId,
      'closed',
      payload.comment || CLOSE_REASON_LABELS[payload.reason],
      null,
      { reason: payload.reason, workflow_status: 'closed' },
    );
    return null;
  }

  async markSuccessful(leadId: string, payload: SuccessfulLeadPayload): Promise<string | null> {
    const error = validateSuccessfulLead(payload);
    if (error) return error;

    const actorId = this.leads.currentUserId();
    const now = new Date().toISOString();
    const contractComment = [
      `№ ${payload.contractNumber}`,
      `сума ${payload.amount} EUR`,
      payload.prepayment != null ? `передоплата ${payload.prepayment} EUR` : null,
      payload.comment,
    ]
      .filter(Boolean)
      .join(', ');

    const { error: contractError } = await this.supabase.from('lead_contracts').insert({
      lead_id: leadId,
      status: 'signed',
      signed_at: now,
      comment: contractComment,
      created_by: actorId,
    });
    if (contractError) throw contractError;

    const { error: updateError } = await this.supabase
      .from('leads')
      .update({
        workflow_status: 'successful',
        lead_status: 'converted',
        workflow_status_changed_at: now,
        lead_status_changed_at: now,
        callback_due_at: null,
        last_comment: payload.comment || `Договір ${payload.contractNumber} заключений.`,
      })
      .eq('id', leadId);
    if (updateError) throw updateError;

    await this.insertEvent(leadId, actorId, 'successful', contractComment, null, {
      workflow_status: 'successful',
      contract_number: payload.contractNumber,
      amount: payload.amount,
    });
    return null;
  }

  private async updateWorkflow(
    leadId: string,
    workflowStatus: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      workflow_status: workflowStatus,
      workflow_status_changed_at: new Date().toISOString(),
      ...extra,
    };
    if (!('callback_due_at' in extra)) {
      delete patch['callback_due_at'];
    }
    const { error } = await this.supabase.from('leads').update(patch).eq('id', leadId);
    if (error) throw error;
  }

  private async insertEvent(
    leadId: string,
    actorId: string,
    eventType: string,
    comment: string | null,
    oldValue: unknown = null,
    newValue: unknown = null,
  ): Promise<void> {
    const { error } = await this.supabase.from('lead_events').insert({
      lead_id: leadId,
      actor_id: actorId,
      event_type: eventType,
      comment,
      old_value: oldValue,
      new_value: newValue,
    });
    if (error) throw error;
  }
}

function mapFirstCallResult(result: string): 'reached' | 'no_answer' | 'cannot_talk' | 'bad_lead' {
  const normalized = result.toLocaleLowerCase('uk-UA');
  if (normalized.includes('нецільов')) return 'bad_lead';
  if (normalized.includes('не відпов')) return 'no_answer';
  if (normalized.includes('передзвон')) return 'cannot_talk';
  return 'reached';
}
