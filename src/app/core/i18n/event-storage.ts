import type { LeadSource } from '../../services/crm-mock.types';
import type { LeadFieldKey } from './field-keys';

export type FirstCallResultCode = 'reached' | 'no_answer' | 'cannot_talk' | 'bad_lead';

export const FIRST_CALL_RESULT_CODES: readonly FirstCallResultCode[] = [
  'reached',
  'no_answer',
  'cannot_talk',
  'bad_lead',
] as const;

export interface LeadCreatedMeta {
  readonly source?: LeadSource;
  readonly source_system?: string;
  readonly source_channel?: string;
  readonly workflow_status?: string;
}

export interface LeadEditAuditMeta {
  readonly edit_audit: {
    readonly fields: readonly string[];
    readonly edited_at: string;
    readonly edited_by: string;
    readonly edited_by_name: string;
  };
}

export interface ContractMeta {
  readonly workflow_status?: string;
  readonly contract_number?: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly signed_at?: string;
  readonly prepayment?: number | null;
}

export interface FirstCallMeta {
  readonly result?: FirstCallResultCode | string;
  readonly workflow_status?: string;
}

export interface VisitMeta {
  readonly scheduled_at?: string;
  readonly workflow_status?: string;
}

export interface CloseMeta {
  readonly reason?: string;
  readonly workflow_status?: string;
}

export type LeadEventNewValue =
  | LeadCreatedMeta
  | LeadEditAuditMeta
  | ContractMeta
  | FirstCallMeta
  | VisitMeta
  | CloseMeta
  | Record<string, unknown>;

export interface RawLeadEventRow {
  readonly event_type: string;
  readonly comment?: string | null;
  readonly new_value: unknown;
}

export function leadFieldKeyFromLegacyUkrainian(field: string): LeadFieldKey | null {
  const map: Record<string, LeadFieldKey> = {
    "імʼя": 'name',
    імя: 'name',
    телефон: 'phone',
    email: 'email',
    'місто/район': 'cityRegion',
    продукт: 'product',
    бюджет: 'budget',
    'початкове повідомлення': 'initialMessage',
    менеджер: 'manager',
    'причина закриття': 'closeReason',
    коментар: 'message',
    повідомлення: 'message',
    тип: 'type',
  };
  return map[field] ?? null;
}
