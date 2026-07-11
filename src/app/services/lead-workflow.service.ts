import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import type { FirstCallResultCode } from '../core/i18n/event-storage';
import { validateCloseLead, validateSuccessfulLead } from './crm-mock.helpers';
import type { CloseLeadPayload, SuccessfulLeadPayload } from './crm-mock.types';
import { LeadsService } from './leads.service';

@Injectable({ providedIn: 'root' })
export class LeadWorkflowService {
  private readonly api = inject(KolssApiClient);
  private readonly leads = inject(LeadsService);

  async takeLead(leadId: string): Promise<void> {
    await this.api.leadAction(leadId, 'take');
  }

  async recordFirstCall(
    leadId: string,
    result: FirstCallResultCode,
    comment: string,
  ): Promise<string | null> {
    if (!result.trim()) return 'validation.firstCallResult';
    if (!comment.trim()) return 'validation.firstCallComment';
    await this.api.leadAction(leadId, 'first-call', { result, comment: comment.trim() });
    return null;
  }

  async scheduleVisit(leadId: string, scheduledAt: string, comment: string): Promise<string | null> {
    if (!scheduledAt.trim()) return 'validation.visitDate';
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return 'validation.visitDateInvalid';
    await this.api.leadAction(leadId, 'schedule-visit', {
      scheduledAt: when.toISOString(),
      comment: comment.trim(),
    });
    return null;
  }

  async rescheduleVisit(leadId: string, scheduledAt: string, comment: string): Promise<string | null> {
    if (!scheduledAt.trim()) return 'validation.visitDate';
    if (!comment.trim()) return 'validation.rescheduleComment';
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return 'validation.visitDateInvalid';
    await this.api.leadAction(leadId, 'reschedule-visit', {
      scheduledAt: when.toISOString(),
      comment: comment.trim(),
    });
    return null;
  }

  async completeVisit(leadId: string, comment: string): Promise<string | null> {
    if (!comment.trim()) return 'validation.visitResult';
    await this.api.leadAction(leadId, 'complete-visit', { comment: comment.trim() });
    return null;
  }

  async addComment(leadId: string, comment: string): Promise<string | null> {
    if (!comment.trim()) return 'validation.commentEmpty';
    await this.api.leadAction(leadId, 'comment', { comment: comment.trim() });
    return null;
  }

  async closeLead(leadId: string, payload: CloseLeadPayload): Promise<string | null> {
    const error = validateCloseLead(payload);
    if (error) return error;
    const reasonError = await this.leads.ensureLossReasonExists(payload.reason);
    if (reasonError) return reasonError;
    await this.api.leadAction(leadId, 'close', payload);
    return null;
  }

  async markSuccessful(leadId: string, payload: SuccessfulLeadPayload): Promise<string | null> {
    const error = validateSuccessfulLead(payload);
    if (error) return error;
    await this.api.leadAction(leadId, 'mark-successful', payload);
    return null;
  }
}
