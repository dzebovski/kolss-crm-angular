import type { Params } from '@angular/router';

import type { V2ClientFilter } from '@domain/v2/client.types';

/** Deep-linkable list state: `?q=marta&filter=with_projects`. */
export interface V2ClientsQuery {
  readonly q: string;
  readonly filter: V2ClientFilter;
}

export const V2_CLIENT_FILTERS: readonly V2ClientFilter[] = ['all', 'with_projects', 'leads_only'];

/** An unknown filter falls back to All clients. */
export function parseV2ClientsQuery(raw: {
  readonly q?: string | null;
  readonly filter?: string | null;
}): V2ClientsQuery {
  return {
    q: raw.q ?? '',
    filter: V2_CLIENT_FILTERS.find((value) => value === raw.filter) ?? 'all',
  };
}

/** Query params for `router.navigate`; defaults are dropped (`null` removes the param). */
export function toV2ClientsQueryParams(query: V2ClientsQuery): Params {
  return {
    q: query.q.trim() || null,
    filter: query.filter === 'all' ? null : query.filter,
  };
}
