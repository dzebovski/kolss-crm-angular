import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  CallStatus,
  ClientStatus,
  CloseReason,
  ContractCurrency,
  LeadActivityPayload,
  QuestionLanguage,
} from '@domain/lead.types';

@Injectable({ providedIn: 'root' })
export class LeadActivitiesService {
  private readonly api = inject(KolssApiClient);

  recordCall(leadId: string, status: CallStatus, comment = '', dueDate = ''): Promise<void> {
    return this.commit(leadId, {
      type: 'call_status',
      status,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(dueDate ? { dueAt: dueAtFromDate(dueDate) } : {}),
    });
  }

  addComment(leadId: string, comment: string, dueDate = '', assignedTo = ''): Promise<void> {
    return this.commit(leadId, {
      type: 'comment',
      comment: comment.trim(),
      ...(dueDate ? { dueAt: dueAtFromDate(dueDate) } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    });
  }

  addQuestion(
    leadId: string,
    comment: string,
    assigneeIds: readonly string[] = [],
    translations: Readonly<Partial<Record<QuestionLanguage, string>>> = {},
  ): Promise<void> {
    return this.commit(leadId, {
      type: 'question',
      comment: comment.trim(),
      ...(assigneeIds.length ? { assigneeIds } : {}),
      ...(Object.keys(translations).length ? { translations } : {}),
    });
  }

  answerQuestion(leadId: string, eventId: string, answer: string): Promise<void> {
    return this.api.answerLeadQuestion(leadId, eventId, answer.trim()).then(() => undefined);
  }

  updateQuestionAnswer(leadId: string, eventId: string, answer: string): Promise<void> {
    return this.api
      .updateLeadQuestionAnswer(leadId, eventId, { answer: answer.trim() })
      .then(() => undefined);
  }

  translateQuestionAnswer(
    leadId: string,
    eventId: string,
    targetLanguage: QuestionLanguage,
  ): Promise<void> {
    return this.api
      .translateLeadQuestionAnswer(leadId, eventId, { targetLanguage })
      .then(() => undefined);
  }

  setClientStatus(
    leadId: string,
    status: Exclude<ClientStatus, 'new_lead' | 'closed_lost' | 'contract_signed'>,
    dueDate = '',
    comment = '',
  ): Promise<void> {
    return this.commit(leadId, {
      type: 'client_status',
      status,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(dueDate ? { dueAt: dueAtFromDate(dueDate) } : {}),
    });
  }

  closeLead(leadId: string, reason: CloseReason, comment: string): Promise<void> {
    return this.commit(leadId, {
      type: 'client_status',
      status: 'closed_lost',
      reason,
      comment: comment.trim(),
    });
  }

  signContract(
    leadId: string,
    contractNumber: string,
    amount: number,
    currency: ContractCurrency,
  ): Promise<void> {
    return this.commit(leadId, {
      type: 'client_status',
      status: 'contract_signed',
      contractNumber: contractNumber.trim(),
      amount,
      currency,
    });
  }

  reopen(leadId: string): Promise<void> {
    return this.commit(leadId, { type: 'reopen' });
  }

  clearReminder(
    leadId: string,
    kind: Extract<LeadActivityPayload, { type: 'clear_reminder' }>['kind'],
  ): Promise<void> {
    return this.commit(leadId, { type: 'clear_reminder', kind });
  }

  private async commit(leadId: string, payload: LeadActivityPayload): Promise<void> {
    await this.api.leadActivity(leadId, payload);
  }
}

export function dueAtFromDate(date: string): string {
  return `${date}T12:00:00.000Z`;
}
