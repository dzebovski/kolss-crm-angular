import type { Params } from '@angular/router';

import type { V2TaskKind, V2TaskView } from '@domain/v2/task.types';
import { V2_TASK_KINDS } from './v2-task-labels';

/**
 * Deep-linkable state of the Tasks page: `?view=upcoming` · `?list=<id>` · `?q=…` ·
 * `?hide=visit,personal` (source chips that are off) · `?who=<userId>` (All tasks) ·
 * `?task=<feed id>` (the open detail panel). My day is the default view and has no param.
 */
export interface V2TasksQuery {
  readonly view: V2TaskView;
  /** The open task list, when `view` is `list`. */
  readonly listId: string | null;
  readonly q: string;
  readonly hidden: readonly V2TaskKind[];
  readonly assigneeId: string;
  readonly taskId: string | null;
}

export interface V2TasksRawQuery {
  readonly view?: string | null;
  readonly list?: string | null;
  readonly q?: string | null;
  readonly hide?: string | null;
  readonly who?: string | null;
  readonly task?: string | null;
}

const PAGE_VIEWS: readonly V2TaskView[] = ['my_day', 'upcoming', 'all', 'done'];

/** Unknown values fall back to the defaults; "All tasks" falls back to My day for those who may not see it. */
export function parseV2TasksQuery(raw: V2TasksRawQuery, canViewAll: boolean): V2TasksQuery {
  const listId = raw.list?.trim() || null;
  const requested = PAGE_VIEWS.find((view) => view === raw.view) ?? 'my_day';
  const view: V2TaskView = listId
    ? 'list'
    : requested === 'all' && !canViewAll
      ? 'my_day'
      : requested;
  const hidden = (raw.hide ?? '').split(',');
  return {
    view,
    listId,
    q: raw.q ?? '',
    hidden: V2_TASK_KINDS.filter((kind) => hidden.includes(kind)),
    assigneeId: view === 'all' ? (raw.who ?? '') : '',
    taskId: raw.task?.trim() || null,
  };
}

/** Query params for `router.navigate`; defaults are dropped (`null` removes the param). */
export function toV2TasksQueryParams(query: V2TasksQuery): Params {
  return {
    view: query.view === 'list' || query.view === 'my_day' ? null : query.view,
    list: query.view === 'list' ? query.listId : null,
    q: query.q.trim() || null,
    hide: query.hidden.length > 0 ? query.hidden.join(',') : null,
    who: query.view === 'all' && query.assigneeId ? query.assigneeId : null,
    task: query.taskId,
  };
}

/** Source chips that stay on, for the API's `kinds` filter; `null` = every chip is on, no filtering. */
export function v2VisibleKinds(
  hidden: readonly V2TaskKind[],
  chips: readonly V2TaskKind[],
): readonly V2TaskKind[] | null {
  const visible = chips.filter((kind) => !hidden.includes(kind));
  return visible.length === chips.length ? null : visible;
}
