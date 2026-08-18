import type { CallStatus, ClientStatus } from '@domain/lead.types';

/**
 * `none`/`callback_undated` are filter-only cohorts (API `CallStatusFilter`):
 * `none` = `call_status is null`, `callback_undated` = `callback_requested`
 * with no due date. Neither is ever a lead's own `call_status`.
 */
export type CallStatusFilterKey = CallStatus | 'none' | 'callback_undated';
/**
 * Filter-only values are not persisted `client_status`es: `in_work` = new
 * lead with a recorded call, `active` = every status except
 * `closed_lost`/`contract_signed` (API `ClientStatusFilter`).
 */
export type ClientStatusFilterKey = ClientStatus | 'in_work' | 'active';

export interface LeadsPagePreferences {
  periodDays: number | null;
  callStatusFilter: readonly CallStatusFilterKey[];
  clientStatusFilter: readonly ClientStatusFilterKey[];
  /** Empty string = no manager filter. */
  managerFilter: string;
}

export const LEADS_PAGE_PREFERENCES_STORAGE_KEY = 'kolss.leads-list-preferences';

const ALLOWED_PERIOD_DAYS = new Set([7, 30, 40, 180]);
const ALLOWED_CALL_STATUS_FILTERS = new Set<CallStatusFilterKey>([
  'reached',
  'no_answer',
  'callback_requested',
  'none',
  'callback_undated',
]);
const ALLOWED_CLIENT_STATUS_FILTERS = new Set<ClientStatusFilterKey>([
  'new_lead',
  'in_work',
  'showroom_invited',
  'measurement_scheduled',
  'calculation_in_progress',
  'thinking',
  'closed_lost',
  'contract_signed',
  'active',
]);

export const DEFAULT_LEADS_PAGE_PREFERENCES: LeadsPagePreferences = {
  periodDays: 7,
  callStatusFilter: [],
  clientStatusFilter: [],
  managerFilter: '',
};

function isManagerFilter(value: unknown): value is string {
  return typeof value === 'string';
}

export function isCallStatusFilterKey(value: unknown): value is CallStatusFilterKey {
  return typeof value === 'string' && ALLOWED_CALL_STATUS_FILTERS.has(value as CallStatusFilterKey);
}

export function isClientStatusFilterKey(value: unknown): value is ClientStatusFilterKey {
  return (
    typeof value === 'string' && ALLOWED_CLIENT_STATUS_FILTERS.has(value as ClientStatusFilterKey)
  );
}

function parseCallStatusFilterKeys(value: unknown): readonly CallStatusFilterKey[] {
  return Array.isArray(value) ? value.filter(isCallStatusFilterKey) : [];
}

function parseClientStatusFilterKeys(value: unknown): readonly ClientStatusFilterKey[] {
  return Array.isArray(value) ? value.filter(isClientStatusFilterKey) : [];
}

export function isPeriodDays(value: unknown): value is number | null {
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
      callStatusFilter: parseCallStatusFilterKeys(record['callStatusFilter']),
      clientStatusFilter: parseClientStatusFilterKeys(record['clientStatusFilter']),
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
