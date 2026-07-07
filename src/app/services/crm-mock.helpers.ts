import type { UiBadgeTone } from '../ui/feedback/ui-badge';
import { CRM_MOCK_NOW, CRM_MOCK_OFFICES } from './crm-mock.data';
import type {
  CloseLeadPayload,
  CloseReason,
  FunnelStage,
  LeadMonthGroup,
  LeadSource,
  LeadWorkflowStatus,
  MockEmployee,
  MockLead,
  OfficeFilter,
  OfficeId,
  SuccessfulLeadPayload,
} from './crm-mock.types';

const MONTH_FORMATTER = new Intl.DateTimeFormat('uk-UA', { month: 'long' });
const DATE_FORMATTER = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const MONEY_FORMATTER = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const OFFICE_FILTER_LABELS: Record<OfficeFilter, string> = {
  all: 'Усі офіси',
  kyiv: 'Київ',
  warsaw: 'Варшава',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Сайт',
  facebook: 'Facebook',
  manual: 'Ручна заявка',
};

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

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  no_contact: 'Немає контакту',
  not_target: 'Нецільовий клієнт',
  location_mismatch: 'Не підходить місцеположення',
  expensive: 'Дорого',
  lost_client: 'Втрачений клієнт',
};

export const FIRST_CALL_RESULTS = [
  'Потреба підтверджена',
  'Заплановано візит',
  'Передзвонити пізніше',
  'Не відповідає',
  'Нецільовий клієнт',
] as const;

export function officeName(officeId: OfficeId): string {
  return CRM_MOCK_OFFICES.find((office) => office.id === officeId)?.nameUk ?? officeId;
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
  if (!value) return '—';
  return DATE_FORMATTER.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return DATE_TIME_FORMATTER.format(new Date(value));
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return MONEY_FORMATTER.format(value);
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
      label: `${MONTH_FORMATTER.format(new Date(year, month - 1, 1))} ${year}`,
      rows,
    };
  });
}

export function validateCloseLead(payload: CloseLeadPayload): string | null {
  if (!payload.reason) return 'Оберіть причину закриття.';
  if (payload.reason === 'lost_client' && !payload.comment.trim()) {
    return 'Для причини "Втрачений клієнт" потрібен коментар.';
  }
  return null;
}

export function validateSuccessfulLead(payload: SuccessfulLeadPayload): string | null {
  if (!payload.contractNumber.trim()) return 'Вкажіть номер договору.';
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return 'Сума договору має бути числом більше нуля.';
  }
  if (payload.prepayment != null && payload.prepayment < 0) {
    return 'Передоплата не може бути відʼємною.';
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
      label: 'Зайшло лідів',
      count: total,
      tone: 'brand' as const,
    },
    {
      key: 'taken',
      label: 'Взяли в роботу',
      count: cohort.filter((lead) => lead.assignedToId || lead.workflowStatus !== 'new').length,
      tone: 'info' as const,
    },
    {
      key: 'scheduled',
      label: 'Очікуються в салоні',
      count: cohort.filter(
        (lead) =>
          lead.workflowStatus === 'visit_scheduled' || lead.workflowStatus === 'visit_rescheduled',
      ).length,
      tone: 'warning' as const,
    },
    {
      key: 'visited',
      label: 'Прийшли в салон',
      count: cohort.filter(
        (lead) => lead.workflowStatus === 'visit_completed' || lead.workflowStatus === 'successful',
      ).length,
      tone: 'success' as const,
    },
    {
      key: 'successful',
      label: 'Успішні',
      count: cohort.filter((lead) => lead.workflowStatus === 'successful').length,
      tone: 'success' as const,
    },
    {
      key: 'closed',
      label: 'Закриті',
      count: cohort.filter((lead) => lead.workflowStatus === 'closed').length,
      tone: 'danger' as const,
    },
  ];

  return counts.map((stage, index) => {
    const previousCount = index === 0 ? stage.count : counts[index - 1].count;
    return {
      ...stage,
      percentOfTotal: total ? Math.round((stage.count / total) * 100) : 0,
      conversionFromPrevious: previousCount ? Math.round((stage.count / previousCount) * 100) : 0,
    };
  });
}
