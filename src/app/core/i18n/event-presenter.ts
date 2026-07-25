import type { LeadEvent, LeadEventEditAudit } from '@domain/lead.types';
import { normalizeFieldKey } from './field-keys';
import type { RawLeadEventRow } from './event-storage';
import { leadFieldKeyFromLegacyUkrainian } from './event-storage';
import { interpolate, type MessageBundle, type MessageKey, type MessageParams } from './messages';

/**
 * Takes the already-loaded message bundle for the locale to render in,
 * rather than a `LocaleCode`, so this module never needs more than one
 * locale's data in memory — the caller (I18nService.activeBundle()) already
 * knows which bundle is loaded. `null` means "not loaded yet"; every lookup
 * degrades to its unknown-key fallback in that case, same as an unknown key.
 */
function translate(bundle: MessageBundle | null, key: MessageKey, params?: MessageParams): string {
  const template = bundle?.[key];
  return template === undefined ? '' : interpolate(template, params);
}

function hasKey(bundle: MessageBundle | null, key: string): key is MessageKey {
  return bundle !== null && key in bundle;
}

const USER_COMMENT_EVENT_TYPES = new Set([
  'comment',
  'comment_added',
  'call_status_changed',
  'client_status_changed',
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

function fieldLabel(fieldKey: string, bundle: MessageBundle | null): string {
  const normalized = normalizeFieldKey(fieldKey);
  const key = `field.${normalized}`;
  if (hasKey(bundle, key)) {
    return translate(bundle, key);
  }
  const legacyKey = leadFieldKeyFromLegacyUkrainian(fieldKey);
  if (legacyKey) {
    const legacyMessageKey = `field.${legacyKey}`;
    if (hasKey(bundle, legacyMessageKey)) {
      return translate(bundle, legacyMessageKey);
    }
  }
  return fieldKey;
}

function formatFieldList(fields: readonly string[], bundle: MessageBundle | null): string {
  return fields.map((field) => fieldLabel(field, bundle)).join(', ');
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

export function presentEventTitle(eventType: string, bundle: MessageBundle | null): string {
  const key = `event.${eventType}`;
  if (hasKey(bundle, key)) return translate(bundle, key);
  return eventType;
}

export function presentEventBody(row: RawLeadEventRow, bundle: MessageBundle | null): string {
  const comment = row.comment?.trim() ?? '';
  const eventType = row.event_type;

  if (eventType === 'call_status_changed' || eventType === 'client_status_changed') {
    if (comment) return comment;
    if (isRecord(row.new_value)) {
      const statusKey = eventType === 'call_status_changed' ? 'call_status' : 'client_status';
      const status = row.new_value[statusKey];
      if (typeof status === 'string') {
        const key = `${eventType === 'call_status_changed' ? 'callStatus' : 'clientStatus'}.${status}`;
        if (hasKey(bundle, key)) return translate(bundle, key);
      }
    }
    return '';
  }

  if (eventType === 'lead_reopened') {
    return translate(bundle, 'clientStatus.new_lead');
  }

  if (eventType === 'created') {
    if (comment && !isLegacySystemComment(comment)) return comment;
    const source = extractCreatedSource(row.new_value);
    if (source) {
      const sourceKey = `source.${source}`;
      const sourceLabel = hasKey(bundle, sourceKey) ? translate(bundle, sourceKey) : source;
      return translate(bundle, 'event.leadCreatedManual', {
        source: sourceLabel,
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
      return translate(bundle, 'event.leadEdited', {
        fields: formatFieldList(audit.fields, bundle),
        editor: audit.editedByName || translate(bundle, 'common.unknown'),
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
      const key = `firstCall.${result}`;
      if (hasKey(bundle, key)) return translate(bundle, key);
      return result;
    }
  }

  return '';
}

export function presentHistoryAuditText(
  event: Pick<LeadEvent, 'editAudit'>,
  bundle: MessageBundle | null,
  formatDateTime: (value: string) => string,
): string {
  if (!event.editAudit || !event.editAudit.fields.length) return '';
  return translate(bundle, 'event.auditEdited', {
    fields: formatFieldList(event.editAudit.fields, bundle),
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

export function presentEventTitleFromLeadEvent(
  event: LeadEvent,
  bundle: MessageBundle | null,
): string {
  return presentEventTitle(event.rawType, bundle);
}

export function presentEventBodyFromLeadEvent(
  event: LeadEvent,
  bundle: MessageBundle | null,
): string {
  return presentEventBody(
    {
      event_type: event.rawType,
      comment: event.comment,
      new_value: event.newValue,
    },
    bundle,
  );
}
