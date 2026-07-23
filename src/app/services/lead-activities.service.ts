import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import type {
  CallStatus,
  ClientStatus,
  ContractCurrency,
  LeadActivityPayload,
} from './crm-mock.types';

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

  addComment(leadId: string, comment: string, dueDate = ''): Promise<void> {
    return this.commit(leadId, {
      type: 'comment',
      comment: comment.trim(),
      ...(dueDate ? { dueAt: dueAtFromDate(dueDate) } : {}),
    });
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

  closeLead(
    leadId: string,
    reason: 'expensive' | 'invalid' | 'other',
    comment: string,
  ): Promise<void> {
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

  private async commit(leadId: string, payload: LeadActivityPayload): Promise<void> {
    await this.api.leadActivity(leadId, payload);
  }
}

export function dueAtFromDate(date: string): string {
  return `${date}T12:00:00.000Z`;
}
