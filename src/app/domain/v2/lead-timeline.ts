import { callbackDueAtFromNewValue } from '@domain/lead.rules';
import type { CallStatus, ClientStatus, Lead, LeadEvent } from '@domain/lead.types';
import type { V2CurrentStatusValue } from './lead-card-status';
import { V2_LEAD_PRODUCTS } from './lead-card.mapper';
import type { V2LeadProduct } from './lead-card.types';
import { deriveV2LeadStatus } from './lead-view.mapper';
import type { V2LeadChannel, V2LeadDisplayStatus, V2LeadRating } from './lead-view.types';

/** Timeline filter groups (lead card v1.3 `cat`); `message` and `system` are never filtered out of their tabs. */
export type V2TimelineCategory = 'message' | 'call' | 'status' | 'comment' | 'system';
export type V2TimelineFilter = 'all' | 'call' | 'status' | 'comment';

export type V2TimelineTitle =
  | { readonly kind: 'status'; readonly status: V2LeadDisplayStatus }
  | {
      readonly kind: 'key';
      readonly key:
        | 'firstMessage'
        | 'leadCreated'
        | 'lost'
        | 'rating'
        | 'comment'
        | 'question'
        | 'contactUpdated';
    }
  /** Anything v2 has no design for: the v1 event title and body. */
  | { readonly kind: 'v1' };

export type V2TimelineRowLabel =
  | 'attempt'
  | 'nextAttempt'
  | 'callBack'
  | 'budget'
  | 'product'
  | 'location'
  | 'nextAction'
  | 'followUp'
  | 'when'
  | 'designer'
  | 'calendar'
  | 'reason'
  | 'reminder'
  | 'assignedTo'
  | 'channel'
  | 'answer';

export type V2TimelineRowValue =
  | V2CurrentStatusValue
  | { readonly kind: 'budget'; readonly amount: string; readonly currency: string | null }
  | { readonly kind: 'products'; readonly products: readonly V2LeadProduct[] }
  | { readonly kind: 'channel'; readonly channel: V2LeadChannel }
  | { readonly kind: 'eventCreated' };

export interface V2TimelineRow {
  readonly label: V2TimelineRowLabel;
  readonly value: V2TimelineRowValue;
}

export type V2TimelineSide =
  | { readonly kind: 'status'; readonly status: V2LeadDisplayStatus }
  | { readonly kind: 'rating'; readonly rating: V2LeadRating | null };

export type V2TimelineTone = V2LeadDisplayStatus | V2LeadRating | 'ink' | 'faint';

export interface V2TimelineItem {
  /** Event id; the synthetic first message (no `created` event) uses `first-message`. */
  readonly id: string;
  /** The source event; null for the synthetic first message. */
  readonly event: LeadEvent | null;
  readonly category: V2TimelineCategory;
  readonly at: string;
  readonly actorId: string | null;
  readonly actorName: string;
  /** Who wrote it when there is no person: the lead form (`Meta lead form`, `Website form`). */
  readonly form: 'meta' | 'website' | null;
  readonly title: V2TimelineTitle;
  readonly tone: V2TimelineTone;
  readonly change: { readonly from: V2TimelineSide; readonly to: V2TimelineSide } | null;
  readonly quote: string | null;
  readonly rows: readonly V2TimelineRow[];
  readonly text: string | null;
  /** `lead_edited`: audit field keys ("Changed: Phone, Channel"). */
  readonly changedFields: readonly string[] | null;
}

const CALL_STATUS: Record<CallStatus, V2LeadDisplayStatus> = {
  reached: 'success',
  no_answer: 'noanswer',
  callback_requested: 'later',
};
const CLIENT_STATUSES: readonly ClientStatus[] = [
  'new_lead',
  'showroom_invited',
  'measurement_scheduled',
  'calculation_in_progress',
  'thinking',
  'postponed',
  'closed_lost',
  'contract_signed',
];
const RATINGS: readonly V2LeadRating[] = ['cold', 'medium', 'hot'];
const COMMENT_TYPES = new Set(['comment', 'comment_added']);
const CREATED_TYPE = 'created';
const EDITED_TYPES = new Set(['lead_edited']);

/**
 * The lead's timeline, newest first, in the lead card v1.3 shapes: first client message as a
 * quote, call results, status changes (from → to), rating changes, comments and system entries.
 * Status changes get their "from" by replaying the call / client statuses in time order.
 */
export function v2LeadTimeline(lead: Lead, channel: V2LeadChannel): readonly V2TimelineItem[] {
  const events = [...lead.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const items: V2TimelineItem[] = [];
  let callStatus: CallStatus | null = null;
  let clientStatus: ClientStatus = 'new_lead';
  let firstMessage = false;

  for (const event of events) {
    if (event.rawType === CREATED_TYPE && !firstMessage) {
      firstMessage = true;
      items.push(firstMessageItem(lead, channel, event));
      continue;
    }
    const before = deriveV2LeadStatus(clientStatus, callStatus);
    if (event.category === 'call_status' && isCallStatus(event.statusCode)) {
      callStatus = event.statusCode;
      items.push(callItem(event, CALL_STATUS[event.statusCode]));
      continue;
    }
    if (event.category === 'client_status' && isClientStatus(event.statusCode)) {
      clientStatus = event.statusCode;
      if (clientStatus === 'new_lead') callStatus = null;
      const after = deriveV2LeadStatus(clientStatus, callStatus);
      items.push(statusItem(event, before, after));
      continue;
    }
    items.push(otherItem(event));
  }

  if (!firstMessage) items.unshift(firstMessageItem(lead, channel, null));
  return items.reverse();
}

/** Lead card v1.3 filter rule: the first message shows in every tab, system entries under Status. */
export function matchesV2TimelineFilter(
  item: Pick<V2TimelineItem, 'category'>,
  filter: V2TimelineFilter,
): boolean {
  return (
    filter === 'all' ||
    item.category === 'message' ||
    item.category === filter ||
    (filter === 'status' && item.category === 'system')
  );
}

function firstMessageItem(
  lead: Lead,
  channel: V2LeadChannel,
  event: LeadEvent | null,
): V2TimelineItem {
  const quote = lead.initialMessage.trim() || null;
  const form = channel === 'meta_ads' ? 'meta' : channel === 'website' ? 'website' : null;
  return {
    ...base(event),
    id: event?.id ?? 'first-message',
    category: 'message',
    at: event?.occurredAt ?? lead.sourceCreatedAt,
    form,
    title: { kind: 'key', key: quote ? 'firstMessage' : 'leadCreated' },
    tone: 'ink',
    quote,
    rows: [{ label: 'channel', value: { kind: 'channel', channel } }],
  };
}

function callItem(event: LeadEvent, status: V2LeadDisplayStatus): V2TimelineItem {
  const value = record(event.newValue);
  const due = callbackDueAtFromNewValue(event.newValue);
  const rows: V2TimelineRow[] = [];
  const add = (label: V2TimelineRowLabel, row: V2TimelineRowValue | null) => {
    if (row) rows.push({ label, value: row });
  };
  if (status === 'noanswer') {
    const attempt = value['attempt'];
    add('attempt', typeof attempt === 'number' ? { kind: 'text', text: String(attempt) } : null);
    add('nextAttempt', dateTime(due));
  } else if (status === 'later') {
    add('callBack', dateTime(due));
  } else {
    add('budget', budget(value['budget']));
    add('product', products(value['products']));
    add('location', text(value['city_region']));
    add('nextAction', text(value['next_action']));
    add('followUp', dateTime(due));
  }
  return {
    ...base(event),
    category: 'call',
    title: { kind: 'status', status },
    tone: status,
    rows,
    text: event.comment?.trim() || null,
  };
}

function statusItem(
  event: LeadEvent,
  from: V2LeadDisplayStatus,
  to: V2LeadDisplayStatus,
): V2TimelineItem {
  const value = record(event.newValue);
  const rows: V2TimelineRow[] = [];
  const add = (label: V2TimelineRowLabel, row: V2TimelineRowValue | null) => {
    if (row) rows.push({ label, value: row });
  };
  if (to === 'thinking' || to === 'postponed') {
    add('followUp', dateTime(callbackDueAtFromNewValue(event.newValue)));
  } else if (to === 'invited') {
    const start = stringValue(value['starts_at']);
    const designer =
      stringValue(value['designer_id']) ?? stringValue(value['responsible_manager_id']);
    add('when', start ? { kind: 'range', start, end: stringValue(value['ends_at']) } : null);
    add('designer', designer ? { kind: 'person', id: designer } : null);
    add('calendar', stringValue(value['appointment_id']) ? { kind: 'eventCreated' } : null);
  } else if (to === 'lost') {
    const reason = stringValue(value['loss_reason']) ?? stringValue(value['reason']);
    add('reason', reason ? { kind: 'lossReason', code: reason } : null);
  }
  return {
    ...base(event),
    category: 'status',
    title: to === 'lost' ? { kind: 'key', key: 'lost' } : { kind: 'status', status: to },
    tone: to,
    change:
      from === to
        ? null
        : { from: { kind: 'status', status: from }, to: { kind: 'status', status: to } },
    rows,
    text: event.comment?.trim() || null,
  };
}

function otherItem(event: LeadEvent): V2TimelineItem {
  const value = record(event.newValue);
  if (event.rawType === 'rating_changed') {
    const from = oneOf(value['from'], RATINGS);
    const to = oneOf(value['to'], RATINGS);
    return {
      ...base(event),
      category: 'status',
      title: { kind: 'key', key: 'rating' },
      tone: to ?? 'faint',
      change: to
        ? { from: { kind: 'rating', rating: from }, to: { kind: 'rating', rating: to } }
        : null,
    };
  }
  if (event.question) {
    const answer = event.question.answer?.text.trim();
    return {
      ...base(event),
      category: 'comment',
      title: { kind: 'key', key: 'question' },
      tone: 'ink',
      rows: answer ? [{ label: 'answer', value: { kind: 'text', text: answer } }] : [],
      text: event.comment?.trim() || null,
    };
  }
  if (event.category === 'comment' || COMMENT_TYPES.has(event.rawType)) {
    const rows: V2TimelineRow[] = [];
    const due = callbackDueAtFromNewValue(event.newValue);
    if (due) rows.push({ label: 'reminder', value: { kind: 'dateTime', at: due } });
    if (event.assignedToId) {
      rows.push({ label: 'assignedTo', value: { kind: 'person', id: event.assignedToId } });
    }
    return {
      ...base(event),
      category: 'comment',
      title: { kind: 'key', key: 'comment' },
      tone: 'ink',
      rows,
      text: event.comment?.trim() || null,
    };
  }
  if (EDITED_TYPES.has(event.rawType)) {
    const fields = value['fields'];
    return {
      ...base(event),
      category: 'system',
      title: { kind: 'key', key: 'contactUpdated' },
      tone: 'faint',
      changedFields: Array.isArray(fields)
        ? fields.filter((field): field is string => typeof field === 'string')
        : [],
    };
  }
  return { ...base(event), category: 'system', title: { kind: 'v1' }, tone: 'faint' };
}

function base(event: LeadEvent | null): V2TimelineItem {
  return {
    id: event?.id ?? '',
    event,
    category: 'system',
    at: event?.occurredAt ?? '',
    actorId: event?.actorId || null,
    actorName: event?.actorName?.trim() ?? '',
    form: null,
    title: { kind: 'v1' },
    tone: 'faint',
    change: null,
    quote: null,
    rows: [],
    text: null,
    changedFields: null,
  };
}

function budget(value: unknown): V2TimelineRowValue | null {
  const data = record(value);
  const amount = stringValue(data['text']);
  if (!amount) return null;
  return { kind: 'budget', amount, currency: stringValue(data['currency']) };
}

function products(value: unknown): V2TimelineRowValue | null {
  if (!Array.isArray(value)) return null;
  const list = V2_LEAD_PRODUCTS.filter((product) => value.includes(product));
  return list.length ? { kind: 'products', products: list } : null;
}

function text(value: unknown): V2TimelineRowValue | null {
  const content = stringValue(value);
  return content ? { kind: 'text', text: content } : null;
}

function dateTime(at: string | null): V2TimelineRowValue | null {
  return at ? { kind: 'dateTime', at } : null;
}

function isCallStatus(value: string | null | undefined): value is CallStatus {
  return value === 'reached' || value === 'no_answer' || value === 'callback_requested';
}

function isClientStatus(value: string | null | undefined): value is ClientStatus {
  return CLIENT_STATUSES.includes(value as ClientStatus);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
