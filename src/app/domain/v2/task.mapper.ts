import type {
  TaskCounts,
  TaskFeedItem,
  TaskFeedResponse,
  TaskList,
} from '@core/api/generated/kolss-api.types';
import type {
  V2Task,
  V2TaskCounts,
  V2TaskFeed,
  V2TaskList,
  V2TaskPerson,
  V2TaskStatus,
} from './task.types';

function person(id: string | null, name: string | null): V2TaskPerson | null {
  return id ? { id, name: name?.trim() || '' } : null;
}

function statusOf(item: TaskFeedItem): V2TaskStatus {
  if (item.status === 'done') return 'done';
  return item.inProgress ? 'progress' : 'todo';
}

export function toV2Task(item: TaskFeedItem): V2Task {
  return {
    id: item.id,
    sourceId: item.sourceId,
    source: item.source,
    kind: item.kind,
    subKind: item.subKind ?? '',
    title: item.title?.trim() ?? '',
    note: item.note?.trim() ?? '',
    status: statusOf(item),
    dueDate: item.dueDate,
    dueTime: item.dueTime,
    overdueDays: item.overdueDays,
    officeId: item.office.id,
    officeCode: item.office.code,
    assignee: person(item.assigneeId, item.assigneeName),
    createdBy: person(item.createdById, item.createdByName),
    link: item.link
      ? {
          type: item.link.type,
          id: item.link.id,
          name: item.link.name,
          code: item.link.code ? item.link.code.toUpperCase() : null,
          phone: item.link.phone,
        }
      : null,
    list: item.list ? { id: item.list.id, name: item.list.name, color: item.list.color } : null,
    version: item.version,
    canManage: item.canManage,
    canEdit: item.canEdit,
    automatic: item.source !== 'manual',
  };
}

export function toV2TaskFeed(response: TaskFeedResponse): V2TaskFeed {
  return { items: response.items.map(toV2Task), truncated: response.truncated };
}

export function toV2TaskList(list: TaskList): V2TaskList {
  return {
    id: list.id,
    name: list.name,
    description: list.description?.trim() ?? '',
    datesText: list.datesText?.trim() ?? '',
    owner: person(list.ownerId, list.ownerName),
    color: list.color,
    version: list.version,
    taskCount: list.taskCount,
    doneCount: list.doneCount,
    overdueCount: list.overdueCount,
    members: list.members.map((member) => ({ id: member.id, name: member.displayName })),
  };
}

export function toV2TaskCounts(counts: TaskCounts): V2TaskCounts {
  return { myDay: counts.myDay, upcoming: counts.upcoming, overdue: counts.overdue };
}
