import type { TaskFeedKind } from '@core/api/generated/kolss-api.types';

/** Source chip of a task row: the API's `kind`. */
export type V2TaskKind = TaskFeedKind;

/** Task status as the board shows it: To do · In progress · Done. */
export type V2TaskStatus = 'todo' | 'progress' | 'done';

/** The views of the Tasks page; `list` is one task list (`listId`). */
export type V2TaskView = 'my_day' | 'upcoming' | 'all' | 'done' | 'list';

export interface V2TaskLink {
  readonly type: 'lead' | 'project' | 'client';
  readonly id: string;
  readonly name: string | null;
  /** Lead reference code (K0418 / W0231), shown uppercase. */
  readonly code: string | null;
  readonly phone: string | null;
}

export interface V2TaskListRef {
  readonly id: string;
  readonly name: string;
  /** `#rrggbb`. */
  readonly color: string;
}

export interface V2TaskPerson {
  readonly id: string;
  readonly name: string;
}

/** One row of the Tasks page: a manual task or an automatic item (call-back, comment reminder, visit). */
export interface V2Task {
  /** Stable feed id (`manual:<uuid>`, `reminder:<kind>:<id>`, `appointment:<uuid>`). */
  readonly id: string;
  /** The row id in its source table: the task uuid for manual tasks. */
  readonly sourceId: string;
  readonly source: 'manual' | 'reminder' | 'appointment' | 'lead';
  readonly kind: V2TaskKind;
  /** task · callback · thinking · comment · showroom · measurement · office_work · no_next_step. */
  readonly subKind: string;
  /** The task's own text; empty for automatic items without one (the CRM titles them by `subKind`). */
  readonly title: string;
  readonly note: string;
  readonly status: V2TaskStatus;
  /** `YYYY-MM-DD`, office-local. */
  readonly dueDate: string | null;
  /** `HH:MM`, office-local. */
  readonly dueTime: string | null;
  /** Whole days past due for an open item, else 0 (office-local, from the API). */
  readonly overdueDays: number;
  readonly officeId: string;
  readonly officeCode: string;
  readonly assignee: V2TaskPerson | null;
  readonly createdBy: V2TaskPerson | null;
  readonly link: V2TaskLink | null;
  readonly list: V2TaskListRef | null;
  /** `If-Match` value; manual tasks only. */
  readonly version: number | null;
  /** Status, progress, assignee, date and time may change (manual tasks the caller may manage). */
  readonly canManage: boolean;
  /** Title and note may change too. */
  readonly canEdit: boolean;
  /** Everything but a manual task is created and closed by something else (read-only here). */
  readonly automatic: boolean;
}

export interface V2TaskListMember {
  readonly id: string;
  readonly name: string;
}

export interface V2TaskList {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Free text such as "12–15 Nov 2026". */
  readonly datesText: string;
  readonly owner: V2TaskPerson | null;
  readonly color: string;
  readonly version: number;
  readonly taskCount: number;
  readonly doneCount: number;
  readonly overdueCount: number;
  readonly members: readonly V2TaskListMember[];
}

/** Sidebar badges. `overdue` is everyone's overdue count, only for admins (else null). */
export interface V2TaskCounts {
  readonly myDay: number;
  readonly upcoming: number;
  readonly overdue: number | null;
}

export interface V2TaskFeed {
  readonly items: readonly V2Task[];
  /** The API dropped items beyond 500. */
  readonly truncated: boolean;
}
