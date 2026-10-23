import { inject, Service } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  CreateManagerTaskRequest,
  CreateTaskListRequest,
  TaskFeedKind,
  UpdateManagerTaskRequest,
  UpdateTaskListRequest,
} from '@core/api/generated/kolss-api.types';
import type { LeadReminderKind } from '@domain/lead.rules';
import { toV2TaskCounts, toV2TaskFeed, toV2TaskList } from '@domain/v2/task.mapper';
import type {
  V2Task,
  V2TaskCounts,
  V2TaskFeed,
  V2TaskList,
  V2TaskStatus,
  V2TaskView,
} from '@domain/v2/task.types';
import { LeadActivitiesService } from '@services/lead-activities.service';

/** What the Tasks page asks `GET /v1/tasks` for. */
export interface V2TaskFeedFilters {
  readonly view: V2TaskView;
  readonly listId: string | null;
  readonly officeId: string | null;
  /** View `all` only. */
  readonly assigneeId: string | null;
  /** Source chips that stay on; `null` = all of them, empty = none (nothing to ask for). */
  readonly kinds: readonly TaskFeedKind[] | null;
  readonly search: string;
}

/**
 * Data access of the v2 Tasks page: the unified feed, sidebar counts, task lists and the task
 * mutations (`PATCH /v1/tasks/{id}` for manual tasks). Returns view models. Delete is the existing
 * `status: canceled` (Q-T3). Components never call `KolssApiClient` directly.
 */
@Service()
export class V2TasksService {
  private readonly api = inject(KolssApiClient);
  private readonly activities = inject(LeadActivitiesService);

  async feed(filters: V2TaskFeedFilters): Promise<V2TaskFeed> {
    if (filters.kinds !== null && filters.kinds.length === 0)
      return { items: [], truncated: false };
    return toV2TaskFeed(
      await this.api.listTasks({
        view: filters.view,
        listId: filters.view === 'list' ? (filters.listId ?? undefined) : undefined,
        assigneeId: filters.view === 'all' ? (filters.assigneeId ?? undefined) : undefined,
        officeId: filters.officeId ?? undefined,
        kinds: filters.kinds ?? undefined,
        q: filters.search.trim() || undefined,
      }),
    );
  }

  async counts(officeId: string | null): Promise<V2TaskCounts> {
    return toV2TaskCounts(await this.api.taskCounts(officeId ?? undefined));
  }

  async lists(): Promise<readonly V2TaskList[]> {
    return (await this.api.taskLists()).items.map(toV2TaskList);
  }

  async createList(request: CreateTaskListRequest): Promise<V2TaskList> {
    return toV2TaskList(await this.api.createTaskList(request));
  }

  async updateList(list: V2TaskList, request: UpdateTaskListRequest): Promise<V2TaskList> {
    return toV2TaskList(await this.api.updateTaskList(list.id, list.version, request));
  }

  async create(request: CreateManagerTaskRequest, idempotencyKey: string): Promise<string> {
    return (await this.api.createManagerTask(request, idempotencyKey)).id;
  }

  /** To do · In progress · Done of a manual task. Reopening starts at "To do". */
  setStatus(task: V2Task, status: V2TaskStatus): Promise<void> {
    return this.patch(task, {
      status: status === 'done' ? 'done' : 'open',
      inProgress: status === 'progress',
    });
  }

  setAssignee(task: V2Task, assigneeId: string): Promise<void> {
    return this.patch(task, { assigneeId });
  }

  /** Clearing the date clears the time as well (API rule). */
  setDue(task: V2Task, dueDate: string | null, dueTime: string | null): Promise<void> {
    return this.patch(task, { dueDate, dueTime: dueDate ? dueTime : null });
  }

  setText(task: V2Task, title: string, note: string): Promise<void> {
    return this.patch(task, { title: title.trim(), note: note.trim() || null });
  }

  /** Soft delete: the task leaves every view (Q-T3). */
  remove(task: V2Task): Promise<void> {
    return this.patch(task, { status: 'canceled' });
  }

  /** A comment reminder closes the way the lead card's "Mark as done" does. */
  clearReminder(leadId: string, kind: LeadReminderKind): Promise<void> {
    return this.activities.clearReminder(leadId, kind);
  }

  private async patch(task: V2Task, body: UpdateManagerTaskRequest): Promise<void> {
    if (task.version === null) throw new Error('error.actionFailed');
    await this.api.patchManagerTask(task.sourceId, task.version, body);
  }
}
