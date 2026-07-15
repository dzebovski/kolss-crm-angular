export type WorkflowFilterKey =
  | 'new'
  | 'callback_required'
  | 'first_call_done'
  | 'visit'
  | 'closed'
  | 'successful';

export type LeadsPagePreferences = {
  periodDays: number | null;
  workflowFilter: WorkflowFilterKey | null;
};

export const LEADS_PAGE_PREFERENCES_STORAGE_KEY = 'kolss.leads-list-preferences';

const ALLOWED_PERIOD_DAYS = new Set([7, 30, 40, 180]);
const ALLOWED_WORKFLOW_FILTERS = new Set<WorkflowFilterKey>([
  'new',
  'callback_required',
  'first_call_done',
  'visit',
  'closed',
  'successful',
]);

export const DEFAULT_LEADS_PAGE_PREFERENCES: LeadsPagePreferences = {
  periodDays: 7,
  workflowFilter: null,
};

function isWorkflowFilterKey(value: unknown): value is WorkflowFilterKey {
  return typeof value === 'string' && ALLOWED_WORKFLOW_FILTERS.has(value as WorkflowFilterKey);
}

function isPeriodDays(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && ALLOWED_PERIOD_DAYS.has(value));
}

export function readLeadsPagePreferences(): LeadsPagePreferences {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return { ...DEFAULT_LEADS_PAGE_PREFERENCES };
    }
    const raw = localStorage.getItem(LEADS_PAGE_PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LEADS_PAGE_PREFERENCES };

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_LEADS_PAGE_PREFERENCES };
    }

    const record = parsed as Record<string, unknown>;
    return {
      periodDays: isPeriodDays(record['periodDays'])
        ? record['periodDays']
        : DEFAULT_LEADS_PAGE_PREFERENCES.periodDays,
      workflowFilter: isWorkflowFilterKey(record['workflowFilter'])
        ? record['workflowFilter']
        : record['workflowFilter'] === null
          ? null
          : DEFAULT_LEADS_PAGE_PREFERENCES.workflowFilter,
    };
  } catch {
    return { ...DEFAULT_LEADS_PAGE_PREFERENCES };
  }
}

export function writeLeadsPagePreferences(prefs: LeadsPagePreferences): void {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
      return;
    }
    localStorage.setItem(LEADS_PAGE_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage failures in tests or private mode
  }
}
