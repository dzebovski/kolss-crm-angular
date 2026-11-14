import type { MessageKey } from '@core/i18n/messages';
import { V2_PROJECT_STATUSES, v2ProjectNextEventLabelKey } from './project-status';
import type {
  V2Money,
  V2ProjectCancelReason,
  V2ProjectCurrency,
  V2ProjectEventType,
  V2ProjectPaymentBasis,
  V2ProjectStatus,
  V2ProjectTimelineEntry,
  V2ProjectType,
} from './project.types';
import { V2_PAYMENT_BASES } from './project-forms';

/**
 * Timeline of the project card, from `GET /v1/projects/{id}/timeline` (API 2.43.0): one line per
 * event with a few short facts. Contract events are history only (pipeline 3). Pure: the screen
 * formats dates, money and names.
 */

export type V2ProjectTimelineTone = V2ProjectStatus | 'ink' | 'faint';

export type V2ProjectRowValue =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'status'; readonly status: V2ProjectStatus }
  | { readonly kind: 'projectType'; readonly type: V2ProjectType }
  | { readonly kind: 'money'; readonly money: V2Money }
  /** A cleared value (e.g. the estimate removed). */
  | { readonly kind: 'removed' }
  | { readonly kind: 'day'; readonly day: string; readonly time: string | null }
  /** An ISO timestamp (calendar appointment start). */
  | { readonly kind: 'dateTime'; readonly at: string }
  | { readonly kind: 'basis'; readonly basis: V2ProjectPaymentBasis }
  | { readonly kind: 'person'; readonly personId: string }
  | { readonly kind: 'reasons'; readonly reasons: readonly V2ProjectCancelReason[] }
  | { readonly kind: 'futureEventsRemoved' };

export interface V2ProjectTimelineRow {
  readonly labelKey: MessageKey;
  readonly value: V2ProjectRowValue;
}

export interface V2ProjectTimelineItem {
  readonly id: string;
  readonly type: V2ProjectEventType;
  readonly at: string;
  /** Null when the API has no author (system). */
  readonly actorName: string | null;
  readonly titleKey: MessageKey;
  readonly tone: V2ProjectTimelineTone;
  /** From → to status pills; null for events without a status move. */
  readonly change: { readonly from: V2ProjectStatus; readonly to: V2ProjectStatus } | null;
  readonly rows: readonly V2ProjectTimelineRow[];
  /** The event comment (Change status / Close project / Project finished). */
  readonly text: string | null;
  /** `created` only: the client code, for "Lead W0218 moved to status Project." */
  readonly leadCode: string | null;
}

const TITLE_KEY: Record<V2ProjectEventType, MessageKey> = {
  created: 'v2.projectCard.event.created',
  status_changed: 'v2.projectCard.event.statusChanged',
  status_updated: 'v2.projectCard.event.statusUpdated',
  cancelled: 'v2.projectCard.event.cancelled',
  restored: 'v2.projectCard.event.restored',
  finished: 'v2.projectCard.event.finished',
  estimate_updated: 'v2.projectCard.event.estimateUpdated',
  contract_added: 'v2.projectCard.event.contractAdded',
  contract_updated: 'v2.projectCard.event.contractUpdated',
  contract_deleted: 'v2.projectCard.event.contractDeleted',
  payment_added: 'v2.projectCard.event.paymentAdded',
  payment_updated: 'v2.projectCard.event.paymentUpdated',
  payment_deleted: 'v2.projectCard.event.paymentDeleted',
  file_added: 'v2.projectCard.event.fileAdded',
  file_deleted: 'v2.projectCard.event.fileDeleted',
  details_updated: 'v2.projectCard.event.detailsUpdated',
  lead_info_updated: 'v2.projectCard.event.leadInfoUpdated',
  comment: 'v2.projectCard.event.comment',
  measurement_visit: 'v2.projectCard.event.measurementVisit',
};

const CURRENCIES: readonly V2ProjectCurrency[] = ['PLN', 'UAH', 'EUR', 'USD'];
const PROJECT_TYPES: readonly V2ProjectType[] = ['express', 'measure', 'contract'];
const CANCEL_REASONS: readonly V2ProjectCancelReason[] = [
  'chose_another_supplier',
  'price_too_high',
  'postponed_renovation',
  'disagreed_design',
  'not_relevant',
  'other',
];

/** Entries in the order the API returns them (newest first). */
export function v2ProjectTimeline(
  entries: readonly V2ProjectTimelineEntry[],
  projectCode: string,
): readonly V2ProjectTimelineItem[] {
  return entries.map((entry) => toItem(entry, projectCode));
}

function toItem(entry: V2ProjectTimelineEntry, projectCode: string): V2ProjectTimelineItem {
  const oldStatus = status(entry.oldValue?.['status']);
  const newStatus = status(entry.newValue?.['status']);
  const base = {
    id: entry.id,
    type: entry.type,
    at: entry.createdAt,
    actorName: entry.actor?.name ?? null,
    titleKey: TITLE_KEY[entry.type],
    text: entry.comment?.trim() || null,
    leadCode: null,
  };

  switch (entry.type) {
    case 'created': {
      const type = projectType(entry.newValue?.['projectType']);
      return {
        ...base,
        tone: 'ink',
        change: null,
        leadCode: projectCode,
        rows: compact([
          type && { labelKey: 'v2.projectCard.row.type', value: { kind: 'projectType', type } },
          newStatus && {
            labelKey: 'v2.projectCard.row.status',
            value: { kind: 'status', status: newStatus },
          },
        ]),
      };
    }
    case 'status_changed':
    case 'status_updated':
      return {
        ...base,
        tone: newStatus ?? 'faint',
        change:
          entry.type === 'status_changed' && oldStatus && newStatus
            ? { from: oldStatus, to: newStatus }
            : null,
        rows: stageRows(entry, newStatus),
      };
    case 'contract_added':
    case 'contract_updated':
    case 'contract_deleted':
      return { ...base, tone: 'contract_signing', change: null, rows: [] };
    case 'payment_added':
    case 'payment_updated':
    case 'payment_deleted': {
      const value = (entry.type === 'payment_deleted' ? entry.oldValue : entry.newValue) ?? {};
      const currency = currencyOf(value['currency'] ?? entry.oldValue?.['currency']);
      const paid = amount(value['amount']);
      const paymentBasis = basis(value['basis']);
      const paidOn = text(value['paidOn']);
      return {
        ...base,
        tone: 'contract_signing',
        change: null,
        rows: compact([
          currency !== null &&
            paid !== null && {
              labelKey: 'v2.projectCard.row.amount',
              value: { kind: 'money', money: { amount: paid, currency } },
            },
          paymentBasis && {
            labelKey: 'v2.projectCard.row.basis',
            value: { kind: 'basis', basis: paymentBasis },
          },
          paidOn && {
            labelKey: 'v2.projectCard.payment.date',
            value: { kind: 'day', day: paidOn, time: null },
          },
        ]),
      };
    }
    case 'file_added':
    case 'file_deleted': {
      const value = (entry.type === 'file_deleted' ? entry.oldValue : entry.newValue) ?? {};
      const name = text(value['fileName']);
      return {
        ...base,
        tone: 'faint',
        change: null,
        rows: compact([
          name && { labelKey: 'v2.projectCard.row.file', value: { kind: 'text', text: name } },
        ]),
      };
    }
    case 'estimate_updated': {
      const currency = currencyOf(entry.newValue?.['currency']);
      const total = amount(entry.newValue?.['amount']);
      return {
        ...base,
        tone: 'preliminary_estimate',
        change: null,
        rows: [
          {
            labelKey: 'v2.projectCard.row.total',
            value:
              currency !== null && total !== null
                ? { kind: 'money', money: { amount: total, currency } }
                : { kind: 'removed' },
          },
        ],
      };
    }
    case 'cancelled': {
      const reasons = reasonList(entry.newValue?.['reasons']);
      return {
        ...base,
        tone: 'cancelled',
        change: null,
        rows: compact([
          reasons.length > 0 && {
            labelKey: 'v2.projectCard.row.reasons',
            value: { kind: 'reasons', reasons },
          },
          entry.newValue?.['futureEventsCancelled'] === true && {
            labelKey: 'v2.projectCard.row.calendar',
            value: { kind: 'futureEventsRemoved' },
          },
        ]),
      };
    }
    case 'finished':
      return { ...base, tone: 'completed', change: null, rows: [] };
    case 'restored':
      return {
        ...base,
        tone: newStatus ?? 'faint',
        change: oldStatus && newStatus ? { from: oldStatus, to: newStatus } : null,
        rows: [],
      };
    case 'details_updated': {
      const manager = text(entry.newValue?.['managerId']);
      const designer = text(entry.newValue?.['designerId']);
      return {
        ...base,
        tone: 'faint',
        change: null,
        rows: compact([
          manager && {
            labelKey: 'v2.projectCard.row.manager',
            value: { kind: 'person', personId: manager },
          },
          designer && {
            labelKey: 'v2.projectCard.row.designer',
            value: { kind: 'person', personId: designer },
          },
        ]),
      };
    }
    case 'lead_info_updated':
      return { ...base, tone: 'faint', change: null, rows: [] };
    case 'comment':
      return { ...base, tone: 'ink', change: null, rows: [] };
    case 'measurement_visit': {
      const startsAt = text(entry.newValue?.['startsAt']);
      return {
        ...base,
        tone: 'measurement_design',
        change: null,
        rows: compact([
          startsAt && {
            labelKey: 'v2.projectCard.row.visit',
            value: { kind: 'dateTime', at: startsAt },
          },
        ]),
      };
    }
  }
}

/** Next-event date of a status change. */
function stageRows(
  entry: V2ProjectTimelineEntry,
  newStatus: V2ProjectStatus | null,
): readonly V2ProjectTimelineRow[] {
  const value = entry.newValue;
  const eventLabel = newStatus ? v2ProjectNextEventLabelKey(newStatus) : null;
  const eventDay = text(value?.['eventDate']);
  return compact([
    eventLabel &&
      eventDay && {
        labelKey: eventLabel,
        value: { kind: 'day', day: eventDay, time: text(value?.['eventTime']) },
      },
  ]);
}

function compact(
  rows: readonly (V2ProjectTimelineRow | false | null | '' | undefined)[],
): readonly V2ProjectTimelineRow[] {
  return rows.filter((row): row is V2ProjectTimelineRow => Boolean(row));
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function status(value: unknown): V2ProjectStatus | null {
  return V2_PROJECT_STATUSES.find((candidate) => candidate === value) ?? null;
}

function currencyOf(value: unknown): V2ProjectCurrency | null {
  return CURRENCIES.find((candidate) => candidate === value) ?? null;
}

function projectType(value: unknown): V2ProjectType | null {
  return PROJECT_TYPES.find((candidate) => candidate === value) ?? null;
}

function basis(value: unknown): V2ProjectPaymentBasis | null {
  return V2_PAYMENT_BASES.find((candidate) => candidate === value) ?? null;
}

function reasonList(value: unknown): readonly V2ProjectCancelReason[] {
  return Array.isArray(value) ? CANCEL_REASONS.filter((reason) => value.includes(reason)) : [];
}
