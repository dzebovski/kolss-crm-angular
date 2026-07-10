import type { LeadEvent, LeadEventEditAudit } from '../../services/crm-mock.types';
import type { LocaleCode } from '../../services/crm-mock.types';
import { normalizeFieldKey } from './field-keys';
import type { RawLeadEventRow } from './event-storage';
import { leadFieldKeyFromLegacyUkrainian } from './event-storage';
import { messages, type MessageKey, translateMessage } from './messages';

const USER_COMMENT_EVENT_TYPES = new Set([
  'comment',
  'contact_attempt',
  'first_call',
  'showroom_visit_scheduled',
  'visit_scheduled',
  'visit_rescheduled',
  'showroom_visit_completed',
  'visit_completed',
  'closed',
  'bad_lead',
  'successful',
  'contract_signed',
]);

const LEGACY_SYSTEM_COMMENT_PATTERNS = [
  /^Лід взято в роботу\.?$/i,
  /^Лід створено вручну\./i,
  /^Дані ліда відредаговано:/i,
  /^Договір .+ заключений\.?$/i,
];

export function isLegacySystemComment(comment: string | null | undefined): boolean {
  const text = comment?.trim() ?? '';
  if (!text) return false;
  return LEGACY_SYSTEM_COMMENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isUserCommentEventType(eventType: string): boolean {
  return USER_COMMENT_EVENT_TYPES.has(eventType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldLabel(fieldKey: string, locale: LocaleCode): string {
  const normalized = normalizeFieldKey(fieldKey);
  const key = `field.${normalized}` as MessageKey;
  if (key in messages) {
    return translateMessage(key, locale);
  }
  const legacyKey = leadFieldKeyFromLegacyUkrainian(fieldKey);
  if (legacyKey) {
    return translateMessage(`field.${legacyKey}` as MessageKey, locale);
  }
  return fieldKey;
}

function formatFieldList(fields: readonly string[], locale: LocaleCode): string {
  return fields.map((field) => fieldLabel(field, locale)).join(', ');
}

function parseEditAudit(value: unknown): LeadEventEditAudit | null {
  if (!isRecord(value)) return null;
  const audit = value['edit_audit'];
  if (!isRecord(audit)) return null;
  const fields = audit['fields'];
  const editedAt = audit['edited_at'];
  const editedById = audit['edited_by'];
  const editedByName = audit['edited_by_name'];
  if (!Array.isArray(fields) || typeof editedAt !== 'string') return null;
  return {
    fields: fields.filter((field): field is string => typeof field === 'string'),
    editedAt,
    editedById: typeof editedById === 'string' ? editedById : '',
    editedByName: typeof editedByName === 'string' ? editedByName : '',
  };
}

export function presentEventTitle(eventType: string, locale: LocaleCode): string {
  const key = `event.${eventType}` as MessageKey;
  if (key in messages) return translateMessage(key, locale);
  return eventType;
}

export function presentEventBody(row: RawLeadEventRow, locale: LocaleCode): string {
  const comment = row.comment?.trim() ?? '';
  const eventType = row.event_type;

  if (eventType === 'created') {
    if (comment && !isLegacySystemComment(comment)) return comment;
    const source = extractCreatedSource(row.new_value);
    if (source) {
      return translateMessage('event.leadCreatedManual', locale, {
        source: translateMessage(`source.${source}` as MessageKey, locale),
      });
    }
    return '';
  }

  if (eventType === 'lead_updated') {
    if (comment && !isLegacySystemComment(comment)) {
      return comment;
    }
    const audit = parseEditAudit(row.new_value);
    if (audit?.fields.length) {
      return translateMessage('event.leadEdited', locale, {
        fields: formatFieldList(audit.fields, locale),
        editor: audit.editedByName || translateMessage('common.unknown', locale),
      });
    }
    return '';
  }

  if (eventType === 'taken' || eventType === 'lead_assigned') {
    return isLegacySystemComment(comment) ? '' : comment;
  }

  if (isUserCommentEventType(eventType)) {
    return comment;
  }

  if (comment && !isLegacySystemComment(comment)) {
    return comment;
  }

  if (isRecord(row.new_value) && 'result' in row.new_value) {
    const result = row.new_value['result'];
    if (typeof result === 'string' && result) {
      const key = `firstCall.${result}` as MessageKey;
      if (key in messages) return translateMessage(key, locale);
      return result;
    }
  }

  return '';
}

export function presentHistoryAuditText(
  event: Pick<LeadEvent, 'editAudit'>,
  locale: LocaleCode,
  formatDateTime: (value: string) => string,
): string {
  if (!event.editAudit || !event.editAudit.fields.length) return '';
  return translateMessage('event.auditEdited', locale, {
    fields: formatFieldList(event.editAudit.fields, locale),
    editor: event.editAudit.editedByName,
    date: formatDateTime(event.editAudit.editedAt),
  });
}

function extractCreatedSource(newValue: unknown): string | null {
  if (!isRecord(newValue)) return null;
  const source = newValue['source'];
  if (typeof source === 'string') return source;
  const channel = newValue['source_channel'];
  if (channel === 'facebook') return 'facebook';
  if (channel === 'office' || channel === 'manual') return 'office';
  if (channel === 'other') return 'other';
  if (channel === 'website') return 'website';
  return null;
}

export function presentEventTitleFromLeadEvent(event: LeadEvent, locale: LocaleCode): string {
  return presentEventTitle(event.rawType, locale);
}

export function presentEventBodyFromLeadEvent(event: LeadEvent, locale: LocaleCode): string {
  return presentEventBody(
    {
      event_type: event.rawType,
      comment: event.comment,
      new_value: event.newValue,
    },
    locale,
  );
}
