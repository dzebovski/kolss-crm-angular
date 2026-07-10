import type { UiBadgeTone } from '../ui/feedback/ui-badge';
import type { UiIconName } from '../ui/icon/ui-icon';
import { CRM_MOCK_NOW } from './crm-mock.data';
import type {
  CloseLeadPayload,
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

export const CREATE_LEAD_SOURCE_OPTIONS: readonly { readonly value: LeadSource; readonly label: string }[] =
  (['office', 'website', 'facebook', 'other'] as const).map((value) => ({
    value,
    label: LEAD_SOURCE_LABELS[value],
  }));

export const WORKFLOW_LABELS: Record<LeadWorkflowStatus, string> = {
  new: 'Нова заявка',
  taken: 'В роботі',
  first_call_done: 'Перший дзвінок',
  visit_scheduled: 'Очікуємо в салоні',
  visit_rescheduled: 'Візит перенесено',
  visit_completed: 'Візит відбувся',
  closed: 'Закритий',
  successful: 'Договір заключений',
};

export const CLOSE_REASON_LABELS: Record<string, string> = {
  no_contact: 'Немає контакту',
  not_target: 'Нецільовий клієнт',
  location_mismatch: 'Не підходить місцеположення',
  expensive: 'Дорого',
  lost_client: 'Втрачений клієнт',
  price: 'Не підійшла ціна',
  spam: 'Сміття / Спам',
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
    first_call_done: 'info',
    visit_scheduled: 'warning',
    visit_rescheduled: 'warning',
    visit_completed: 'success',
    closed: 'danger',
    successful: 'success',
  };
  return tones[status];
}

export function leadIsTerminal(lead: MockLead): boolean {
  return lead.workflowStatus === 'closed' || lead.workflowStatus === 'successful';
}

export function formatDate(value: string | null | undefined): string {
  return formatDateForLocale(value, getActiveLocale());
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDateTimeForLocale(value, getActiveLocale());
}

export function formatMoney(value: number | null | undefined): string {
  return formatMoneyForLocale(value, getActiveLocale());
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
    };
  });
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
  if (payload.prepayment != null && payload.prepayment < 0) {
    return 'validation.prepaymentNegative';
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
  return lead.firstManagerId ?? lead.assignedToId;
}

export function calculateManagerTakenReport(
  leads: readonly MockLead[],
  employees: readonly ManagerReportEmployee[],
  officeCode: OfficeId,
  periodDays = 40,
): ManagerOfficeReport {
  const cohort = filterLeadsByPeriod(leads, periodDays);
  const takenLeads = cohort.filter(
    (lead) => lead.officeCode === officeCode && isLeadTaken(lead),
  );

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
    .sort((left, right) => right.takenCount - left.takenCount || left.managerName.localeCompare(right.managerName, getActiveLocale()));

  return {
    officeCode,
    officeLabel: officeName(officeCode),
    managers,
    unassignedCount,
  };
}
