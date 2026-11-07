import type { MessageKey } from '@core/i18n/messages';
import { V2_PROJECT_STATUSES, v2ProjectNextEventLabelKey } from './project-status';
import type {
  V2Money,
  V2ProjectCancelReason,
  V2ProjectContractKind,
  V2ProjectCurrency,
  V2ProjectEventType,
  V2ProjectStatus,
  V2ProjectTimelineEntry,
  V2ProjectType,
} from './project.types';
import { V2_ESTIMATE_LINES } from './project-money';

/**
 * Timeline of the project card, from `GET /v1/projects/{id}/timeline` (API 2.42.0). Contract and
 * payment events carry the contract kind (intro / main); a comment is its own event. Pure: the
 * screen formats dates, money and names.
 */

export type V2ProjectTimelineTone = V2ProjectStatus | 'ink' | 'faint';

export type V2ProjectRowValue =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'status'; readonly status: V2ProjectStatus }
  | { readonly kind: 'projectType'; readonly type: V2ProjectType }
  | { readonly kind: 'money'; readonly money: V2Money }
  /** `paid` of `total`, in one currency. */
  | { readonly kind: 'moneyOf'; readonly paid: V2Money; readonly total: V2Money }
  | { readonly kind: 'day'; readonly day: string; readonly time: string | null }
  /** An ISO timestamp (calendar appointment start). */
  | { readonly kind: 'dateTime'; readonly at: string }
  | { readonly kind: 'contractKind'; readonly contractKind: V2ProjectContractKind }
  | { readonly kind: 'estimateLine'; readonly money: V2Money | null }
  | { readonly kind: 'person'; readonly personId: string }
  | { readonly kind: 'reasons'; readonly reasons: readonly V2ProjectCancelReason[] }
  | { readonly kind: 'futureEventsRemoved' }
  /** Less than 50% was paid when an admin moved the project to production. */
  | { readonly kind: 'prepaymentOverride' };

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
  /** The event comment (timeline note of Change status / Cancel project). */
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
  estimate_updated: 'v2.projectCard.event.estimateUpdated',
  contract_added: 'v2.projectCard.event.contractAdded',
  contract_updated: 'v2.projectCard.event.contractUpdated',
  contract_deleted: 'v2.projectCard.event.contractDeleted',
  payment_added: 'v2.projectCard.event.paymentAdded',
  payment_updated: 'v2.projectCard.event.paymentUpdated',
  payment_deleted: 'v2.projectCard.event.paymentDeleted',
  details_updated: 'v2.projectCard.event.detailsUpdated',
  lead_info_updated: 'v2.projectCard.event.leadInfoUpdated',
  comment: 'v2.projectCard.event.comment',
  measurement_visit: 'v2.projectCard.event.measurementVisit',
};

const CONTRACT_KINDS: readonly V2ProjectContractKind[] = ['intro', 'main'];

const CONTRACT_TITLE: Record<
  'contract_added' | 'contract_updated' | 'contract_deleted',
  Record<V2ProjectContractKind, MessageKey>
> = {
  contract_added: {
    intro: 'v2.projectCard.event.introAdded',
    main: 'v2.projectCard.event.mainAdded',
  },
  contract_updated: {
    intro: 'v2.projectCard.event.introUpdated',
    main: 'v2.projectCard.event.mainUpdated',
  },
  contract_deleted: {
    intro: 'v2.projectCard.event.introDeleted',
    main: 'v2.projectCard.event.mainDeleted',
  },
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
    case 'contract_deleted': {
      const value = (entry.type === 'contract_deleted' ? entry.oldValue : entry.newValue) ?? {};
      const kind = contractKind(value['kind'] ?? entry.oldValue?.['kind']);
      const currency = currencyOf(value['currency'] ?? entry.oldValue?.['currency']);
      const total = amount(value['totalAmount']);
      const number = text(value['number']);
      const signedOn = text(value['signedOn']);
      return {
        ...base,
        titleKey: kind ? CONTRACT_TITLE[entry.type][kind] : base.titleKey,
        tone: kind === 'intro' ? 'intro_contract' : 'main_contract',
        change:
          entry.type === 'contract_added' && oldStatus && newStatus && oldStatus !== newStatus
            ? { from: oldStatus, to: newStatus }
            : null,
        rows: compact([
          number && {
            labelKey: 'v2.projectCard.row.contract',
            value: { kind: 'text', text: number },
          },
          currency !== null &&
            total !== null && {
              labelKey: 'v2.projectCard.row.total',
              value: { kind: 'money', money: { amount: total, currency } },
            },
          signedOn && {
            labelKey: 'v2.projectCard.row.signed',
            value: { kind: 'day', day: signedOn, time: null },
          },
        ]),
      };
    }
    case 'payment_added':
    case 'payment_updated':
    case 'payment_deleted': {
      const value = (entry.type === 'payment_deleted' ? entry.oldValue : entry.newValue) ?? {};
      const kind = contractKind(value['contractKind']);
      const currency = currencyOf(value['currency']);
      const paid = amount(value['amount']);
      const paidAfter = amount(value['paidAfter']);
      const total = amount(value['total']);
      const paidOn = text(value['paidOn']);
      const note = text(value['note']);
      return {
        ...base,
        tone: kind === 'intro' ? 'intro_contract' : 'main_contract',
        change: null,
        rows: compact([
          kind && {
            labelKey: 'v2.projectCard.row.contract',
            value: { kind: 'contractKind', contractKind: kind },
          },
          currency !== null &&
            paid !== null && {
              labelKey: 'v2.projectCard.row.amount',
              value: { kind: 'money', money: { amount: paid, currency } },
            },
          currency !== null &&
            paidAfter !== null &&
            total !== null && {
              labelKey: 'v2.projectCard.row.paidAfter',
              value: {
                kind: 'moneyOf',
                paid: { amount: paidAfter, currency },
                total: { amount: total, currency },
              },
            },
          paidOn && {
            labelKey: 'v2.projectCard.payment.date',
            value: { kind: 'day', day: paidOn, time: null },
          },
          note && { labelKey: 'v2.projectCard.row.note', value: { kind: 'text', text: note } },
        ]),
      };
    }
    case 'estimate_updated':
      return { ...base, tone: 'estimate', change: null, rows: estimateRows(entry) };
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
        tone: 'design',
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

/** Next-event date of a status change, and the 50% override note. */
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
    value?.['prepaymentOverride'] === true && {
      labelKey: 'v2.projectCard.row.prepayment',
      value: { kind: 'prepaymentOverride' },
    },
  ]);
}

/** One row per changed estimate line; a removed line has no money. */
function estimateRows(entry: V2ProjectTimelineEntry): readonly V2ProjectTimelineRow[] {
  return V2_ESTIMATE_LINES.filter((line) => entry.newValue !== null && line in entry.newValue).map(
    (line) => {
      const value = record(entry.newValue?.[line]);
      const currency = currencyOf(value?.['currency']);
      const money = amount(value?.['amount']);
      return {
        labelKey: `v2.project.estimate.${line}` as MessageKey,
        value: {
          kind: 'estimateLine',
          money: currency !== null && money !== null ? { amount: money, currency } : null,
        },
      };
    },
  );
}

function compact(
  rows: readonly (V2ProjectTimelineRow | false | null | '' | undefined)[],
): readonly V2ProjectTimelineRow[] {
  return rows.filter((row): row is V2ProjectTimelineRow => Boolean(row));
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function contractKind(value: unknown): V2ProjectContractKind | null {
  return CONTRACT_KINDS.find((candidate) => candidate === value) ?? null;
}

function reasonList(value: unknown): readonly V2ProjectCancelReason[] {
  return Array.isArray(value) ? CANCEL_REASONS.filter((reason) => value.includes(reason)) : [];
}
