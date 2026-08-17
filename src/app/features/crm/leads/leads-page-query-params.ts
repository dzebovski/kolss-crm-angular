import { isOfficeId } from '@core/office/office.config';
import type { OfficeFilter } from '@domain/office.types';
import {
  DEFAULT_LEADS_PAGE_PREFERENCES,
  isCallStatusFilterKey,
  isClientStatusFilterKey,
  isPeriodDays,
  type CallStatusFilterKey,
  type ClientStatusFilterKey,
  type LeadsPagePreferences,
} from './leads-page-preferences.storage';

/**
 * Full leads-list state that a shareable link carries, e.g.
 * `/crm/leads?office=warsaw&clientStatus=new_lead&days=30`.
 */
export interface LeadsPageQueryState {
  /** Office *code* (`SessionService` filters by code); `null` = no office param. */
  readonly office: OfficeFilter | null;
  readonly periodDays: number | null;
  readonly callStatusFilter: readonly CallStatusFilterKey[];
  readonly clientStatusFilter: readonly ClientStatusFilterKey[];
  /** Empty string = no manager filter. */
  readonly managerFilter: string;
  readonly query: string;
  readonly showArchived: boolean;
}

/** Every param this page owns — also the probe set for "is this a filter deep link?". */
const QUERY_KEYS = [
  'office',
  'clientStatus',
  'callStatus',
  'days',
  'assignedTo',
  'q',
  'archived',
] as const;

const ALL_PERIODS = 'all';
const ARCHIVED_ONLY = 'only';

export interface ReadonlyParamMap {
  get(name: string): string | null;
}

function parseOffice(value: string | null): OfficeFilter | null {
  if (value === 'all') return 'all';
  return isOfficeId(value) ? value : null;
}

function parsePeriodDays(value: string | null): number | null {
  if (value === ALL_PERIODS) return null;
  const days = Number(value);
  if (value !== null && value !== '' && isPeriodDays(days)) return days;
  return DEFAULT_LEADS_PAGE_PREFERENCES.periodDays;
}

function parseList<T extends string>(
  value: string | null,
  isAllowed: (candidate: unknown) => candidate is T,
): readonly T[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(isAllowed);
}

/**
 * Returns `null` when the URL carries no recognised param, so the caller can
 * fall back to the stored preferences. When at least one param is present the
 * link is the single source of truth and every missing key falls back to the
 * page defaults — otherwise the same link would show different leads to the
 * sender and the receiver.
 */
export function parseLeadsPageQuery(params: ReadonlyParamMap): LeadsPageQueryState | null {
  if (!QUERY_KEYS.some((key) => params.get(key) !== null)) return null;

  return {
    office: parseOffice(params.get('office')),
    periodDays: parsePeriodDays(params.get('days')),
    callStatusFilter: parseList(params.get('callStatus'), isCallStatusFilterKey),
    clientStatusFilter: parseList(params.get('clientStatus'), isClientStatusFilterKey),
    managerFilter: params.get('assignedTo')?.trim() ?? '',
    query: params.get('q')?.trim() ?? '',
    showArchived: params.get('archived') === ARCHIVED_ONLY,
  };
}

/** Defaults-only keys are omitted to keep shared links readable. */
export function serializeLeadsPageQuery(state: LeadsPageQueryState): Record<string, string> {
  const params: Record<string, string> = {};
  if (state.office) params['office'] = state.office;
  if (state.clientStatusFilter.length) {
    params['clientStatus'] = state.clientStatusFilter.join(',');
  }
  if (state.callStatusFilter.length) params['callStatus'] = state.callStatusFilter.join(',');
  // Always written, even at the default: it guarantees every generated URL has
  // at least one param, so `parseLeadsPageQuery` treats it as a deep link and
  // the receiver never silently falls back to their own stored filters.
  params['days'] = state.periodDays === null ? ALL_PERIODS : String(state.periodDays);
  if (state.managerFilter) params['assignedTo'] = state.managerFilter;
  if (state.query) params['q'] = state.query;
  if (state.showArchived) params['archived'] = ARCHIVED_ONLY;
  return params;
}

/** Seed for a plain visit to `/crm/leads`, where filters come from local storage. */
export function leadsPageQueryStateFromPreferences(
  preferences: LeadsPagePreferences,
): LeadsPageQueryState {
  return {
    office: null,
    periodDays: preferences.periodDays,
    callStatusFilter: preferences.callStatusFilter,
    clientStatusFilter: preferences.clientStatusFilter,
    managerFilter: preferences.managerFilter,
    query: '',
    showArchived: false,
  };
}
