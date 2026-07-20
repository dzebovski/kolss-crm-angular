import type { UiBadgeTone } from '../ui/feedback/ui-badge';
import type { UiIconName } from '../ui/icon/ui-icon';
import { CRM_MOCK_NOW } from './crm-mock.data';
import type {
  CloseLeadPayload,
  CallStatus,
  ClientStatus,
  ContractCurrency,
  ContractCurrencyTotal,
  FunnelStage,
  LeadMonthGroup,
  ManagerOfficeReport,
  ManagerTakenRow,
  LeadSource,
  LeadWorkflowStatus,
  MockEmployee,
  MockLead,
  OfficeFilter,
  OfficeId,
  SuccessfulLeadPayload,
} from './crm-mock.types';

import { getActiveLocale } from '../core/i18n/locale-storage';
import {
  formatDateForLocale,
  formatDateTimeForLocale,
  formatMoneyForLocale,
  formatMonthYearForLocale,
} from '../core/i18n/locale-format';

export const OFFICE_FILTER_LABELS: Record<OfficeFilter, string> = {
  all: 'Усі офіси',
  kyiv: 'Київ',
  warsaw: 'Варшава',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Сайт',
  facebook: 'Facebook Forms',
  office: 'Офіс',
  other: 'Інше',
};

export const LEAD_SOURCE_ICONS: Record<LeadSource, UiIconName> = {
  website: 'public',
  facebook: 'campaign',
  office: 'person',
  other: 'more_horiz',
};

export const CREATE_LEAD_SOURCE_OPTIONS: readonly {
  readonly value: LeadSource;
  readonly label: string;
}[] = (['office', 'website', 'facebook', 'other'] as const).map((value) => ({
  value,
  label: LEAD_SOURCE_LABELS[value],
}));

export const WORKFLOW_LABELS: Record<LeadWorkflowStatus, string> = {
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

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  reached: 'Успішний дзвінок',
  no_answer: 'Не дозвонилися',
  callback_requested: 'Передзвонити',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  new_lead: 'Нова заявка',
  showroom_invited: 'Запрошено в салон',
  calculation_in_progress: 'Прорахунок',
  thinking: 'Думає',
  closed_lost: 'Закрито',
  contract_signed: 'Договір підписано',
};

export const CLOSE_REASON_LABELS: Record<string, string> = {
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

export function lossReasonLabel(
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

export const FIRST_CALL_RESULT_CODES = ['reached', 'no_answer', 'cannot_talk', 'bad_lead'] as const;

export type FirstCallResultCode = (typeof FIRST_CALL_RESULT_CODES)[number];

/** @deprecated Use FIRST_CALL_RESULT_CODES with I18nService.firstCallResultLabel */
export const FIRST_CALL_RESULTS = [
  'Потреба підтверджена',
  'Заплановано візит',
  'Передзвонити пізніше',
  'Не відповідає',
  'Нецільовий клієнт',
] as const;

export function officeName(officeId: OfficeId): string {
  return OFFICE_FILTER_LABELS[officeId] ?? officeId;
}

export function employeeName(
  employees: readonly MockEmployee[],
  employeeId: string | null,
): string {
  if (!employeeId) return 'Не призначено';
  return employees.find((employee) => employee.id === employeeId)?.displayName ?? 'Невідомий';
}

export function employeeInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('uk-UA') ?? '')
    .join('');
}

export function workflowTone(status: LeadWorkflowStatus): UiBadgeTone {
  const tones: Record<LeadWorkflowStatus, UiBadgeTone> = {
    new: 'brand',
    taken: 'info',
    callback_required: 'warning',
    first_call_done: 'info',
    visit_scheduled: 'warning',
    visit_rescheduled: 'warning',
    visit_completed: 'success',
    thinking: 'warning',
    closed: 'danger',
    successful: 'success',
  };
  return tones[status];
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
    calculation_in_progress: 'warning',
    thinking: 'brand',
    closed_lost: 'danger',
    contract_signed: 'success',
  };
  return tones[status];
}

/** A still-new lead that already has a recorded call is treated as "in work". */
export function leadIsInWork(lead: MockLead): boolean {
  return lead.clientStatus === 'new_lead' && !!lead.callStatus;
}

export function clientStatusToneForLead(lead: MockLead): UiBadgeTone {
  if (leadIsInWork(lead)) return 'info';
  return clientStatusTone(lead.clientStatus);
}

export function leadIsTerminal(lead: MockLead): boolean {
  return lead.clientStatus === 'closed_lost' || lead.clientStatus === 'contract_signed';
}

export function formatDate(value: string | null | undefined): string {
  return formatDateForLocale(value, getActiveLocale());
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDateTimeForLocale(value, getActiveLocale());
}

export function formatMoney(value: number | null | undefined, currency = 'EUR'): string {
  return formatMoneyForLocale(value, getActiveLocale(), currency);
}

export function filterLeadsByOffice(
  leads: readonly MockLead[],
  officeFilter: OfficeFilter,
): readonly MockLead[] {
  if (officeFilter === 'all') return leads;
  return leads.filter((lead) => lead.officeCode === officeFilter);
}

export function matchesLeadSearch(lead: MockLead, rawQuery: string): boolean {
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

export function groupLeadsByYearMonth(leads: readonly MockLead[]): readonly LeadMonthGroup[] {
  const sorted = [...leads].sort(
    (left, right) =>
      new Date(right.sourceCreatedAt).getTime() - new Date(left.sourceCreatedAt).getTime(),
  );
  const groups = new Map<string, MockLead[]>();

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
  readonly key: 'new' | 'callback' | 'showroom' | 'calculation' | 'in_work' | 'paused';
  readonly tone: UiBadgeTone;
  readonly icon: UiIconName;
  readonly rows: readonly MockLead[];
}

/**
 * Splits active leads into the manager reminder buckets shown on the dashboard.
 * Each lead lands in exactly one group (first match wins); closed/won and
 * archived leads are dropped.
 */
export function groupLeadsForDashboard(leads: readonly MockLead[]): readonly DashboardLeadGroup[] {
  const newLeads: MockLead[] = [];
  const callback: MockLead[] = [];
  const showroom: MockLead[] = [];
  const calculation: MockLead[] = [];
  const paused: MockLead[] = [];
  const inWork: MockLead[] = [];

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
    { key: 'calculation', tone: 'warning', icon: 'bar_chart', rows: calculation },
    { key: 'in_work', tone: 'info', icon: 'automation', rows: inWork },
    { key: 'paused', tone: 'info', icon: 'history', rows: paused },
  ];
}

export const CONTRACT_CURRENCIES = [
  'UAH',
  'USD',
  'EUR',
  'PLN',
] as const satisfies readonly ContractCurrency[];

export function sumContractsByCurrency(
  rows: readonly MockLead[],
): readonly ContractCurrencyTotal[] {
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

export interface ContractCurrencyOption {
  readonly code: ContractCurrency;
  readonly symbol: string;
}

const KYIV_CURRENCIES: readonly ContractCurrencyOption[] = [
  { code: 'UAH', symbol: '₴' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
];

const WARSAW_CURRENCIES: readonly ContractCurrencyOption[] = [
  { code: 'PLN', symbol: 'zł' },
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
];

export function currenciesForOffice(office: OfficeId): readonly ContractCurrencyOption[] {
  return office === 'warsaw' ? WARSAW_CURRENCIES : KYIV_CURRENCIES;
}

export function defaultCurrencyForOffice(office: OfficeId): ContractCurrency {
  return office === 'warsaw' ? 'PLN' : 'UAH';
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

export function calculateFunnel(
  leads: readonly MockLead[],
  periodDays = 40,
): readonly FunnelStage[] {
  const now = new Date(CRM_MOCK_NOW).getTime();
  const periodStart = now - periodDays * 24 * 60 * 60 * 1000;
  const cohort = leads.filter((lead) => new Date(lead.sourceCreatedAt).getTime() >= periodStart);
  const total = cohort.length;

  const counts = [
    {
      key: 'created',
      label: 'funnel.created',
      count: total,
      tone: 'brand' as const,
    },
    {
      key: 'taken',
      label: 'funnel.taken',
      count: cohort.filter((lead) => lead.assignedToId || lead.workflowStatus !== 'new').length,
      tone: 'info' as const,
    },
    {
      key: 'scheduled',
      label: 'funnel.scheduled',
      count: cohort.filter(
        (lead) =>
          lead.workflowStatus === 'visit_scheduled' || lead.workflowStatus === 'visit_rescheduled',
      ).length,
      tone: 'warning' as const,
    },
    {
      key: 'visited',
      label: 'funnel.visited',
      count: cohort.filter(
        (lead) => lead.workflowStatus === 'visit_completed' || lead.workflowStatus === 'successful',
      ).length,
      tone: 'success' as const,
    },
    {
      key: 'successful',
      label: 'funnel.successful',
      count: cohort.filter((lead) => lead.workflowStatus === 'successful').length,
      tone: 'success' as const,
    },
    {
      key: 'closed',
      label: 'funnel.closed',
      count: cohort.filter((lead) => lead.workflowStatus === 'closed').length,
      tone: 'danger' as const,
    },
  ];

  const stageByKey = new Map(counts.map((stage) => [stage.key, stage] as const));

  const conversionBaseKey = (key: string): string | null => {
    switch (key) {
      case 'created':
        return null;
      case 'taken':
        return 'created';
      case 'scheduled':
        return 'taken';
      case 'visited':
        return 'scheduled';
      case 'successful':
      case 'closed':
        return 'taken';
      default:
        return null;
    }
  };

  return counts.map((stage) => {
    const baseKey = conversionBaseKey(stage.key);
    const baseStage = baseKey ? stageByKey.get(baseKey) : null;
    const baseCount = baseStage?.count ?? 0;
    return {
      ...stage,
      percentOfTotal: total ? Math.round((stage.count / total) * 100) : 0,
      conversionFromPrevious: baseCount ? Math.round((stage.count / baseCount) * 100) : 0,
      conversionBaseLabel: baseStage?.label ?? null,
    };
  });
}

export interface ManagerReportEmployee {
  readonly id: string;
  readonly displayName: string;
  readonly role: string;
  readonly officeIds: readonly OfficeId[];
}

function filterLeadsByPeriod(leads: readonly MockLead[], periodDays: number): readonly MockLead[] {
  const now = new Date(CRM_MOCK_NOW).getTime();
  const periodStart = now - periodDays * 24 * 60 * 60 * 1000;
  return leads.filter((lead) => new Date(lead.sourceCreatedAt).getTime() >= periodStart);
}

function isLeadTaken(lead: MockLead): boolean {
  return Boolean(lead.assignedToId) || lead.workflowStatus !== 'new';
}

function managerIdForTakenLead(lead: MockLead): string | null {
  return lead.assignedToId;
}

export function calculateManagerTakenReport(
  leads: readonly MockLead[],
  employees: readonly ManagerReportEmployee[],
  officeCode: OfficeId,
  periodDays = 40,
): ManagerOfficeReport {
  const cohort = filterLeadsByPeriod(leads, periodDays);
  const takenLeads = cohort.filter((lead) => lead.officeCode === officeCode && isLeadTaken(lead));

  const counts = new Map<string, number>();
  let unassignedCount = 0;

  for (const lead of takenLeads) {
    const managerId = managerIdForTakenLead(lead);
    if (!managerId) {
      unassignedCount += 1;
      continue;
    }
    counts.set(managerId, (counts.get(managerId) ?? 0) + 1);
  }

  const managers: ManagerTakenRow[] = employees
    .filter(
      (employee) => employee.role === 'office_member' && employee.officeIds.includes(officeCode),
    )
    .map((employee) => ({
      managerId: employee.id,
      managerName: employee.displayName,
      takenCount: counts.get(employee.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.takenCount - left.takenCount ||
        left.managerName.localeCompare(right.managerName, getActiveLocale()),
    );

  return {
    officeCode,
    officeLabel: officeName(officeCode),
    managers,
    unassignedCount,
  };
}
