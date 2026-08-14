import type { UiBadgeTone } from '@ui/feedback/ui-badge';
import type { UiIconName } from '@ui/icon/ui-icon';
import type {
  CloseLeadPayload,
  CallStatus,
  ClientStatus,
  ContractCurrency,
  ContractCurrencyTotal,
  Lead,
  LeadMonthGroup,
  LeadWorkflowStatus,
  SuccessfulLeadPayload,
} from './lead.types';
import type { OfficeFilter, OfficeId } from './office.types';

import { OFFICE_CONFIG } from '@core/office/office.config';
import { getActiveLocale } from '@core/i18n/locale-storage';
import {
  formatDateForLocale,
  formatDateTimeForLocale,
  formatMonthYearForLocale,
} from '@core/i18n/locale-format';

/** Only used to build the lead-search haystack below; never surfaced directly. */
const OFFICE_FILTER_LABELS: Record<OfficeFilter, string> = {
  all: 'Усі офіси',
  kyiv: 'Київ',
  warsaw: 'Варшава',
};

/** Only used to build the lead-search haystack below; never surfaced directly. */
const WORKFLOW_LABELS: Record<LeadWorkflowStatus, string> = {
  new: 'Нова заявка',
  taken: 'В роботі',
  callback_required: 'Потрібно передзвонити',
  first_call_done: 'Перший дзвінок',
  visit_scheduled: 'Очікуємо в салоні',
  visit_rescheduled: 'Візит перенесено',
  visit_completed: 'Візит відбувся',
  thinking: 'Думає',
  closed: 'Закритий',
  successful: 'Договір заключений',
};

/** Only used by resolveCloseUserComment below to strip auto-filled reason text. */
const CLOSE_REASON_LABELS: Record<string, string> = {
  no_contact: 'Немає контакту',
  not_target: 'Нецільовий клієнт',
  location_mismatch: 'Не підходить місцеположення',
  expensive: 'Дорого',
  lost_client: 'Втрачений клієнт',
  price: 'Не підійшла ціна',
  spam: 'Сміття / Спам',
  invalid: 'Невалідна заявка',
  other: 'Інше',
};

function lossReasonLabel(
  code: string,
  reasons?: readonly { readonly code: string; readonly label_uk: string }[],
): string {
  const fromDb = reasons?.find((item) => item.code === code)?.label_uk;
  if (fromDb) return fromDb;
  return CLOSE_REASON_LABELS[code] ?? code;
}

/** Strips auto-filled reason labels; returns only the manager's additional comment. */
export function resolveCloseUserComment(
  rawComment: string | null | undefined,
  reason: string,
  reasons?: readonly { readonly code: string; readonly label_uk: string }[],
): string {
  const comment = rawComment?.trim() ?? '';
  if (!comment) return '';

  const reasonLabels = new Set(
    [reason, CLOSE_REASON_LABELS[reason], lossReasonLabel(reason, reasons)].filter(Boolean),
  );
  return reasonLabels.has(comment) ? '' : comment;
}

/** Only used to build the lead-search haystack below; never surfaced directly. */
function officeName(officeId: OfficeId): string {
  return OFFICE_FILTER_LABELS[officeId] ?? officeId;
}

export function employeeInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('uk-UA') ?? '')
    .join('');
}

export function callStatusTone(status: CallStatus | null): UiBadgeTone {
  if (status === 'reached') return 'success';
  if (status === 'no_answer') return 'danger';
  if (status === 'callback_requested') return 'brand';
  return 'neutral';
}

export function clientStatusTone(status: ClientStatus): UiBadgeTone {
  const tones: Record<ClientStatus, UiBadgeTone> = {
    new_lead: 'brand',
    showroom_invited: 'info',
    measurement_scheduled: 'teal',
    calculation_in_progress: 'warning',
    thinking: 'brand',
    closed_lost: 'danger',
    contract_signed: 'success',
  };
  return tones[status];
}

/** A still-new lead that already has a recorded call is treated as "in work". */
export function leadIsInWork(lead: Lead): boolean {
  return lead.clientStatus === 'new_lead' && !!lead.callStatus;
}

export function clientStatusToneForLead(lead: Lead): UiBadgeTone {
  if (leadIsInWork(lead)) return 'info';
  return clientStatusTone(lead.clientStatus);
}

/** Terminal statuses end the work on a lead — no groups, no reminders, no tasks. */
export function clientStatusIsTerminal(status: string): boolean {
  return status === 'closed_lost' || status === 'contract_signed';
}

export function leadIsTerminal(lead: Lead): boolean {
  return clientStatusIsTerminal(lead.clientStatus);
}

/** Only used to build the lead-search haystack below; never surfaced directly. */
function formatDate(value: string | null | undefined): string {
  return formatDateForLocale(value, getActiveLocale());
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDateTimeForLocale(value, getActiveLocale());
}

export function matchesLeadSearch(lead: Lead, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase('uk-UA');
  if (!query) return true;
  const haystack = [
    lead.name,
    lead.phone,
    lead.email ?? '',
    formatDate(lead.sourceCreatedAt),
    lead.sourceCreatedAt.slice(0, 10),
    officeName(lead.officeCode),
    WORKFLOW_LABELS[lead.workflowStatus],
  ]
    .join(' ')
    .toLocaleLowerCase('uk-UA');
  return haystack.includes(query);
}

export function groupLeadsByYearMonth(leads: readonly Lead[]): readonly LeadMonthGroup[] {
  const sorted = [...leads].sort(
    (left, right) =>
      new Date(right.sourceCreatedAt).getTime() - new Date(left.sourceCreatedAt).getTime(),
  );
  const groups = new Map<string, Lead[]>();

  for (const lead of sorted) {
    const date = new Date(lead.sourceCreatedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const rows = groups.get(key) ?? [];
    rows.push(lead);
    groups.set(key, rows);
  }

  return [...groups.entries()].map(([key, rows]) => {
    const [year, month] = key.split('-').map(Number);
    return {
      key,
      label: formatMonthYearForLocale(year, month, getActiveLocale()),
      rows,
      contractTotals: sumContractsByCurrency(rows),
    };
  });
}

export interface DashboardLeadGroup {
  readonly key:
    'new' | 'callback' | 'showroom' | 'measurement' | 'calculation' | 'in_work' | 'paused';
  readonly tone: UiBadgeTone;
  readonly icon: UiIconName;
  readonly rows: readonly Lead[];
}

/**
 * Splits active leads into the manager reminder buckets shown on the dashboard.
 * Each lead lands in exactly one group (first match wins); closed/won and
 * archived leads are dropped.
 */
export function groupLeadsForDashboard(leads: readonly Lead[]): readonly DashboardLeadGroup[] {
  const newLeads: Lead[] = [];
  const callback: Lead[] = [];
  const showroom: Lead[] = [];
  const measurement: Lead[] = [];
  const calculation: Lead[] = [];
  const paused: Lead[] = [];
  const inWork: Lead[] = [];

  for (const lead of leads) {
    if (lead.archivedAt) continue;
    if (leadIsTerminal(lead)) continue;

    if (lead.clientStatus === 'thinking' || lead.workflowStatus === 'thinking') {
      paused.push(lead);
    } else if (
      lead.clientStatus === 'showroom_invited' ||
      lead.workflowStatus === 'visit_scheduled' ||
      lead.workflowStatus === 'visit_rescheduled'
    ) {
      showroom.push(lead);
    } else if (lead.clientStatus === 'measurement_scheduled') {
      measurement.push(lead);
    } else if (lead.clientStatus === 'calculation_in_progress') {
      calculation.push(lead);
    } else if (lead.callStatus === 'no_answer' || lead.callStatus === 'callback_requested') {
      callback.push(lead);
    } else if (lead.clientStatus === 'new_lead' && lead.callStatus === null) {
      newLeads.push(lead);
    } else {
      inWork.push(lead);
    }
  }

  return [
    { key: 'new', tone: 'brand', icon: 'campaign', rows: newLeads },
    { key: 'callback', tone: 'warning', icon: 'phone_missed', rows: callback },
    { key: 'showroom', tone: 'info', icon: 'schedule', rows: showroom },
    { key: 'measurement', tone: 'teal', icon: 'straighten', rows: measurement },
    { key: 'calculation', tone: 'warning', icon: 'bar_chart', rows: calculation },
    { key: 'in_work', tone: 'info', icon: 'automation', rows: inWork },
    { key: 'paused', tone: 'info', icon: 'history', rows: paused },
  ];
}

/** Only used by sumContractsByCurrency below to keep totals in a stable currency order. */
const CONTRACT_CURRENCIES = [
  'UAH',
  'USD',
  'EUR',
  'PLN',
] as const satisfies readonly ContractCurrency[];

export function sumContractsByCurrency(rows: readonly Lead[]): readonly ContractCurrencyTotal[] {
  const totals = new Map<ContractCurrency, number>();

  for (const lead of rows) {
    const contract = lead.contract;
    if (!contract) continue;
    totals.set(contract.currency, (totals.get(contract.currency) ?? 0) + contract.amount);
  }

  if (totals.size === 0) return [];

  return CONTRACT_CURRENCIES.filter((currency) => totals.has(currency)).map((currency) => ({
    currency,
    total: totals.get(currency)!,
  }));
}

export function defaultCurrencyForOffice(office: OfficeId): ContractCurrency {
  return OFFICE_CONFIG[office].currency;
}

export function isContractCurrency(value: unknown): value is ContractCurrency {
  return typeof value === 'string' && (CONTRACT_CURRENCIES as readonly string[]).includes(value);
}

export function validateCloseLead(payload: CloseLeadPayload): string | null {
  if (!payload.reason) return 'validation.closeReasonRequired';
  if (payload.reason === 'lost_client' && !payload.comment.trim()) {
    return 'validation.lostClientComment';
  }
  return null;
}

export function validateSuccessfulLead(payload: SuccessfulLeadPayload): string | null {
  if (!payload.contractNumber.trim()) return 'validation.contractNumber';
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return 'validation.contractAmount';
  }
  if (!isContractCurrency(payload.currency)) {
    return 'validation.contractCurrency';
  }
  return null;
}

/** Reads callback_due_at from a lead event / latest comment new_value payload. */
export function callbackDueAtFromNewValue(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const due = (value as Record<string, unknown>)['callback_due_at'];
  return typeof due === 'string' && due.trim() ? due : null;
}

/** Returns the API-derived reminder on the latest explicit comment. */
export function commentDueAtForLead(lead: { commentReminderDueAt: string | null }): string | null {
  return lead.commentReminderDueAt;
}

export type LeadReminderKind = 'callback' | 'thinking' | 'comment' | 'showroom' | 'measurement';

export interface LeadActiveReminder {
  readonly kind: LeadReminderKind;
  readonly dueAt: string;
}

/**
 * Active due-dated reminders shown at the top of the lead card.
 * Callback and thinking share leads.callbackDueAt; comment uses the derived
 * field; showroom uses the scheduled visit date. Closed leads have none — the
 * API already blanks these fields, this keeps stale cached rows honest too.
 */
export function activeRemindersForLead(lead: {
  callStatus: string | null;
  clientStatus: string;
  callbackDueAt: string | null;
  commentReminderDueAt: string | null;
  callbackDueContext?: { category: string; statusCode: string | null } | null;
  showroomDueAt?: string | null;
  measurementDueAt?: string | null;
}): readonly LeadActiveReminder[] {
  if (clientStatusIsTerminal(lead.clientStatus)) return [];

  const reminders: LeadActiveReminder[] = [];
  if (lead.callStatus === 'callback_requested' && lead.callbackDueAt) {
    reminders.push({ kind: 'callback', dueAt: lead.callbackDueAt });
  }
  if (lead.clientStatus === 'thinking' && lead.callbackDueAt) {
    reminders.push({ kind: 'thinking', dueAt: lead.callbackDueAt });
  }
  const showroomDueAt = showroomDueAtForLead(lead);
  if (showroomDueAt) {
    reminders.push({ kind: 'showroom', dueAt: showroomDueAt });
  }
  const measurementDueAt = measurementDueAtForLead(lead);
  if (measurementDueAt) {
    reminders.push({ kind: 'measurement', dueAt: measurementDueAt });
  }
  if (lead.commentReminderDueAt) {
    reminders.push({ kind: 'comment', dueAt: lead.commentReminderDueAt });
  }
  return reminders;
}

/** Returns the assignee of the active comment task (latest comment), if any. */
export function commentAssigneeForLead(lead: {
  commentReminderAssignedTo: string | null;
}): string | null {
  return lead.commentReminderAssignedTo;
}

/** Returns the active showroom date independently of callback/comment due dates. */
export function showroomDueAtForLead(lead: {
  callbackDueAt: string | null;
  callbackDueContext?: { category: string; statusCode: string | null } | null;
  showroomDueAt?: string | null;
}): string | null {
  if (lead.showroomDueAt !== undefined) return lead.showroomDueAt;
  return lead.callbackDueContext?.category === 'client_status' &&
    lead.callbackDueContext.statusCode === 'showroom_invited'
    ? lead.callbackDueAt
    : null;
}

/** Returns the active on-site measurement date, same derivation as the showroom one. */
export function measurementDueAtForLead(lead: {
  callbackDueAt: string | null;
  callbackDueContext?: { category: string; statusCode: string | null } | null;
  measurementDueAt?: string | null;
}): string | null {
  if (lead.measurementDueAt !== undefined) return lead.measurementDueAt;
  return lead.callbackDueContext?.category === 'client_status' &&
    lead.callbackDueContext.statusCode === 'measurement_scheduled'
    ? lead.callbackDueAt
    : null;
}
