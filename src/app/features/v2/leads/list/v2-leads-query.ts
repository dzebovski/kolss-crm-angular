import type { Params } from '@angular/router';

import {
  V2_DEFAULT_LEAD_PERIOD,
  V2_LEAD_PERIOD_DAYS,
  V2_LEAD_RATING_FILTERS,
  V2_LEAD_STATUS_FILTERS,
  type V2LeadPeriod,
} from '@domain/v2/lead-list.rules';
import type { V2LeadRating, V2LeadStatus } from '@domain/v2/lead-view.types';

/** Deep-linkable list filters: `?q=…&period=week&status=later,noanswer&rating=hot`. */
export interface V2LeadsQuery {
  readonly q: string;
  readonly period: V2LeadPeriod;
  readonly createdFrom: string | null;
  readonly createdTo: string | null;
  readonly statuses: readonly V2LeadStatus[];
  readonly ratings: readonly V2LeadRating[];
}

export interface V2LeadsRawQuery {
  readonly q?: string | null;
  readonly period?: string | null;
  readonly createdFrom?: string | null;
  readonly createdTo?: string | null;
  readonly status?: string | null;
  readonly rating?: string | null;
}

/** Unknown values and an incomplete/invalid custom range fall back to the defaults. */
export function parseV2LeadsQuery(raw: V2LeadsRawQuery): V2LeadsQuery {
  const period = raw.period ?? '';
  const customValid =
    period === 'custom' &&
    isDateOnly(raw.createdFrom) &&
    isDateOnly(raw.createdTo) &&
    raw.createdFrom <= raw.createdTo;
  const statuses = (raw.status ?? '')
    .split(',')
    .filter((value): value is V2LeadStatus =>
      V2_LEAD_STATUS_FILTERS.includes(value as V2LeadStatus),
    );
  const ratings = (raw.rating ?? '')
    .split(',')
    .filter((value): value is V2LeadRating =>
      V2_LEAD_RATING_FILTERS.includes(value as V2LeadRating),
    );
  return {
    q: raw.q ?? '',
    period: customValid
      ? 'custom'
      : period in V2_LEAD_PERIOD_DAYS && period !== 'custom'
        ? (period as V2LeadPeriod)
        : V2_DEFAULT_LEAD_PERIOD,
    createdFrom: customValid ? raw.createdFrom : null,
    createdTo: customValid ? raw.createdTo : null,
    statuses: V2_LEAD_STATUS_FILTERS.filter((status) => statuses.includes(status)),
    ratings: V2_LEAD_RATING_FILTERS.filter((rating) => ratings.includes(rating)),
  };
}

/** Query params for `router.navigate`; defaults are dropped (`null` removes the param). */
export function toV2LeadsQueryParams(query: V2LeadsQuery): Params {
  return {
    q: query.q.trim() || null,
    period: query.period === V2_DEFAULT_LEAD_PERIOD ? null : query.period,
    createdFrom: query.period === 'custom' ? query.createdFrom : null,
    createdTo: query.period === 'custom' ? query.createdTo : null,
    status: query.statuses.length > 0 ? query.statuses.join(',') : null,
    rating: query.ratings.length > 0 ? query.ratings.join(',') : null,
  };
}

function isDateOnly(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
