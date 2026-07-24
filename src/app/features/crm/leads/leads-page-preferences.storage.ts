import type { CallStatus, ClientStatus } from '../../../services/crm-mock.types';

export type CallStatusFilterKey = CallStatus;
/** Filter-only value `in_work` is not a persisted client_status. */
export type ClientStatusFilterKey = ClientStatus | 'in_work';

export interface LeadsPagePreferences {
  periodDays: number | null;
  callStatusFilter: CallStatusFilterKey | null;
  clientStatusFilter: ClientStatusFilterKey | null;
  /** Empty string = no manager filter. */
  managerFilter: string;
}

export const LEADS_PAGE_PREFERENCES_STORAGE_KEY = 'kolss.leads-list-preferences';

const ALLOWED_PERIOD_DAYS = new Set([7, 30, 40, 180]);
const ALLOWED_CALL_STATUS_FILTERS = new Set<CallStatusFilterKey>([
  'reached',
  'no_answer',
  'callback_requested',
]);
const ALLOWED_CLIENT_STATUS_FILTERS = new Set<ClientStatusFilterKey>([
  'new_lead',
  'in_work',
  'showroom_invited',
  'calculation_in_progress',
  'thinking',
  'closed_lost',
  'contract_signed',
]);

export const DEFAULT_LEADS_PAGE_PREFERENCES: LeadsPagePreferences = {
  periodDays: 7,
  callStatusFilter: null,
  clientStatusFilter: null,
  managerFilter: '',
};

function isManagerFilter(value: unknown): value is string {
  return typeof value === 'string';
}

function isCallStatusFilterKey(value: unknown): value is CallStatusFilterKey {
  return typeof value === 'string' && ALLOWED_CALL_STATUS_FILTERS.has(value as CallStatusFilterKey);
}

function isClientStatusFilterKey(value: unknown): value is ClientStatusFilterKey {
  return (
    typeof value === 'string' &&
    ALLOWED_CLIENT_STATUS_FILTERS.has(value as ClientStatusFilterKey)
  );
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
      callStatusFilter: isCallStatusFilterKey(record['callStatusFilter'])
        ? record['callStatusFilter']
        : DEFAULT_LEADS_PAGE_PREFERENCES.callStatusFilter,
      clientStatusFilter: isClientStatusFilterKey(record['clientStatusFilter'])
        ? record['clientStatusFilter']
        : DEFAULT_LEADS_PAGE_PREFERENCES.clientStatusFilter,
      managerFilter: isManagerFilter(record['managerFilter'])
        ? record['managerFilter']
        : DEFAULT_LEADS_PAGE_PREFERENCES.managerFilter,
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
