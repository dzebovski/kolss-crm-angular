import {
  isCallStatusFilterKey,
  isClientStatusFilterKey,
  type CallStatusFilterKey,
  type ClientStatusFilterKey,
} from '@domain/lead-filters';
import { isLeadReactionKind } from '@domain/lead-reactions';
import type { LeadReactionKind } from '@domain/lead.types';

/** `created` = newest arrivals grouped by month; `activity` = most recently changed first. */
export type LeadsSortMode = 'created' | 'activity';

export function isLeadsSortMode(value: unknown): value is LeadsSortMode {
  return value === 'created' || value === 'activity';
}

export interface LeadsPagePreferences {
  periodDays: number | null;
  callStatusFilter: readonly CallStatusFilterKey[];
  clientStatusFilter: readonly ClientStatusFilterKey[];
  /** Concrete client statuses also match leads that held them before. */
  clientStatusEver: boolean;
  /** Empty string = no manager filter. */
  managerFilter: string;
  sortMode: LeadsSortMode;
  /** Empty = no reaction filter; otherwise leads with anyone's reaction of these kinds. */
  reactionFilter: readonly LeadReactionKind[];
}

export const LEADS_PAGE_PREFERENCES_STORAGE_KEY = 'kolss.leads-list-preferences';

const ALLOWED_PERIOD_DAYS = new Set([7, 30, 40, 180]);
export const DEFAULT_LEADS_PAGE_PREFERENCES: LeadsPagePreferences = {
  periodDays: 7,
  callStatusFilter: [],
  clientStatusFilter: [],
  clientStatusEver: false,
  managerFilter: '',
  sortMode: 'created',
  reactionFilter: [],
};

function isManagerFilter(value: unknown): value is string {
  return typeof value === 'string';
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
      clientStatusEver: record['clientStatusEver'] === true,
      managerFilter: isManagerFilter(record['managerFilter'])
        ? record['managerFilter']
        : DEFAULT_LEADS_PAGE_PREFERENCES.managerFilter,
      sortMode: isLeadsSortMode(record['sortMode'])
        ? record['sortMode']
        : DEFAULT_LEADS_PAGE_PREFERENCES.sortMode,
      reactionFilter: Array.isArray(record['reactionFilter'])
        ? record['reactionFilter'].filter(isLeadReactionKind)
        : [],
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
