import type { Params } from '@angular/router';

import {
  V2_DEFAULT_LEAD_PERIOD,
  V2_LEAD_PERIOD_DAYS,
  V2_LEAD_STATUS_FILTERS,
  type V2LeadPeriod,
} from '@domain/v2/lead-list.rules';
import type { V2LeadStatus } from '@domain/v2/lead-view.types';

/** Deep-linkable list filters: `?q=…&period=week&status=later,noanswer`. */
export interface V2LeadsQuery {
  readonly q: string;
  readonly period: V2LeadPeriod;
  readonly statuses: readonly V2LeadStatus[];
}

export interface V2LeadsRawQuery {
  readonly q?: string | null;
  readonly period?: string | null;
  readonly status?: string | null;
}

/** Unknown values fall back to the defaults; `custom` too, until its range picker exists. */
export function parseV2LeadsQuery(raw: V2LeadsRawQuery): V2LeadsQuery {
  const period = raw.period ?? '';
  const statuses = (raw.status ?? '')
    .split(',')
    .filter((value): value is V2LeadStatus =>
      V2_LEAD_STATUS_FILTERS.includes(value as V2LeadStatus),
    );
  return {
    q: raw.q ?? '',
    period:
      period in V2_LEAD_PERIOD_DAYS && period !== 'custom'
        ? (period as V2LeadPeriod)
        : V2_DEFAULT_LEAD_PERIOD,
    statuses: V2_LEAD_STATUS_FILTERS.filter((status) => statuses.includes(status)),
  };
}

/** Query params for `router.navigate`; defaults are dropped (`null` removes the param). */
export function toV2LeadsQueryParams(query: V2LeadsQuery): Params {
  return {
    q: query.q.trim() || null,
    period: query.period === V2_DEFAULT_LEAD_PERIOD ? null : query.period,
    status: query.statuses.length > 0 ? query.statuses.join(',') : null,
  };
}
