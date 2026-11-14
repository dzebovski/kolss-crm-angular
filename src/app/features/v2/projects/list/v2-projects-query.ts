import type { Params } from '@angular/router';

import type { ProjectListQuery } from '@core/api/generated/kolss-api.types';
import { V2_PROJECT_FILTER_ORDER } from '@domain/v2/project-status';
import type { V2ProjectStatus } from '@domain/v2/project.types';

/** List or kanban (owner decision 2026-10-23: Projects = kanban + list). */
export type V2ProjectsView = 'list' | 'kanban';

/** Deep-linkable filters: `?view=kanban&q=…&manager=<uuid>&status=factory_approval,installation`. */
export interface V2ProjectsQuery {
  readonly view: V2ProjectsView;
  readonly q: string;
  /** Manager id, empty = all managers. */
  readonly manager: string;
  readonly statuses: readonly V2ProjectStatus[];
}

export interface V2ProjectsRawQuery {
  readonly view?: string | null;
  readonly q?: string | null;
  readonly manager?: string | null;
  readonly status?: string | null;
}

/** Unknown statuses are dropped; the rest follow the chips' order. */
export function parseV2ProjectsQuery(raw: V2ProjectsRawQuery): V2ProjectsQuery {
  const requested = (raw.status ?? '').split(',');
  return {
    view: raw.view === 'kanban' ? 'kanban' : 'list',
    q: raw.q ?? '',
    manager: raw.manager ?? '',
    statuses: V2_PROJECT_FILTER_ORDER.filter((status) => requested.includes(status)),
  };
}

/** Query params for `router.navigate`; defaults are dropped (`null` removes the param). */
export function toV2ProjectsQueryParams(query: V2ProjectsQuery): Params {
  return {
    view: query.view === 'kanban' ? 'kanban' : null,
    q: query.q.trim() || null,
    manager: query.manager || null,
    status: query.statuses.length > 0 ? query.statuses.join(',') : null,
  };
}

/** The filters that go to the API: the URL query plus the selected office. */
export interface V2ProjectsFilterSet {
  readonly officeId: string | null;
  readonly q: string;
  readonly managerId: string;
  readonly statuses: readonly V2ProjectStatus[];
}

/** `GET /v1/projects` and `/facets` filters (no paging). */
export function toV2ProjectsApiQuery(
  filters: V2ProjectsFilterSet,
): Omit<ProjectListQuery, 'limit' | 'cursor'> {
  return {
    q: filters.q || undefined,
    managerId: filters.managerId || undefined,
    officeId: filters.officeId ?? undefined,
    status: filters.statuses.length > 0 ? filters.statuses : undefined,
  };
}
