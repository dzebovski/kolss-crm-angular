import type {
  CreateManagerTaskRequest,
  CreateTaskListRequest,
  UpdateTaskListRequest,
} from '@core/api/generated/kolss-api.types';
import type { V2TaskList } from './task.types';

/**
 * Validation and request building for the New task and New task list popups (boards
 * `Tasks-new-task`, `Tasks-new-task-errors`, `Tasks-new-list`). Pure: the popups only bind fields.
 */

/** "Linked to" choices. Only `none`, `lead` and `list` are accepted by the API for now (T1). */
export type V2NewTaskLinkKind = 'none' | 'lead' | 'client' | 'project' | 'list';

export const V2_NEW_TASK_LINK_KINDS: readonly V2NewTaskLinkKind[] = [
  'none',
  'lead',
  'client',
  'project',
  'list',
];

/** The API refuses client and project links until those features can validate them (T1). */
export function v2TaskLinkKindAvailable(kind: V2NewTaskLinkKind): boolean {
  return kind !== 'client' && kind !== 'project';
}

export interface V2NewTaskDraft {
  readonly title: string;
  readonly linkKind: V2NewTaskLinkKind;
  /** Lead id or task list id, per `linkKind`. */
  readonly linkId: string;
  readonly assigneeId: string;
  /** `YYYY-MM-DD` or empty. */
  readonly date: string;
  /** `HH:MM` or empty; needs a date. */
  readonly time: string;
  readonly note: string;
}

export type V2NewTaskField = 'title' | 'link' | 'assignee' | 'date';
export type V2NewTaskError = 'titleRequired' | 'linkRequired' | 'assigneeRequired' | 'datePassed';

/** Board errors: empty title, a chosen link kind without a link, no assignee, a date in the past. */
export function v2ValidateNewTask(
  draft: V2NewTaskDraft,
  today: string,
): Partial<Record<V2NewTaskField, V2NewTaskError>> {
  const errors: Partial<Record<V2NewTaskField, V2NewTaskError>> = {};
  if (!draft.title.trim()) errors.title = 'titleRequired';
  if (draft.linkKind !== 'none' && !draft.linkId) errors.link = 'linkRequired';
  if (!draft.assigneeId) errors.assignee = 'assigneeRequired';
  if (draft.date && draft.date < today) errors.date = 'datePassed';
  return errors;
}

export interface V2OfficeChoice {
  /** The linked lead's office: a task and its lead share an office. */
  readonly leadOfficeId: string | null;
  /** The header office switcher, when one office is picked. */
  readonly selectedOfficeId: string | null;
  readonly userOfficeIds: readonly string[];
  readonly assigneeOfficeIds: readonly string[];
}

/**
 * The board has no office field, so the task's office follows the context: the linked lead's,
 * the picked office in the header, else an office the creator and the assignee share, else the
 * creator's first. `null` when the creator has no office at all.
 */
export function v2TaskOfficeId(choice: V2OfficeChoice): string | null {
  if (choice.leadOfficeId) return choice.leadOfficeId;
  if (choice.selectedOfficeId) return choice.selectedOfficeId;
  const shared = choice.userOfficeIds.find((id) => choice.assigneeOfficeIds.includes(id));
  return shared ?? choice.userOfficeIds[0] ?? null;
}

export function v2CreateTaskRequest(
  draft: V2NewTaskDraft,
  officeId: string,
): CreateManagerTaskRequest {
  const hasDate = draft.date !== '';
  const note = draft.note.trim();
  return {
    officeId,
    assigneeId: draft.assigneeId,
    title: draft.title.trim(),
    dueDate: hasDate ? draft.date : null,
    dueTime: hasDate && draft.time ? draft.time : null,
    note: note || null,
    listId: draft.linkKind === 'list' ? draft.linkId : null,
    link: draft.linkKind === 'lead' ? { type: 'lead', id: draft.linkId } : null,
  };
}

export interface V2NewListDraft {
  readonly name: string;
  readonly description: string;
  readonly datesText: string;
  readonly ownerId: string;
}

export type V2NewListField = 'name' | 'owner';
export type V2NewListError = 'nameRequired' | 'ownerRequired';

export function v2ValidateNewList(
  draft: V2NewListDraft,
): Partial<Record<V2NewListField, V2NewListError>> {
  const errors: Partial<Record<V2NewListField, V2NewListError>> = {};
  if (!draft.name.trim()) errors.name = 'nameRequired';
  if (!draft.ownerId) errors.owner = 'ownerRequired';
  return errors;
}

export function v2CreateListRequest(draft: V2NewListDraft): CreateTaskListRequest {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    datesText: draft.datesText.trim() || null,
    ownerId: draft.ownerId,
  };
}

/** The fields of an existing list as the popup shows them. */
export function v2ListDraft(list: V2TaskList): V2NewListDraft {
  return {
    name: list.name,
    description: list.description,
    datesText: list.datesText,
    ownerId: list.owner?.id ?? '',
  };
}

/** Edit list sends only what changed; `null` when nothing did. */
export function v2UpdateListRequest(
  list: V2TaskList,
  draft: V2NewListDraft,
): UpdateTaskListRequest | null {
  const before = v2ListDraft(list);
  const request: {
    name?: string;
    description?: string | null;
    datesText?: string | null;
    ownerId?: string;
  } = {};
  if (draft.name.trim() !== before.name) request.name = draft.name.trim();
  if (draft.description.trim() !== before.description)
    request.description = draft.description.trim() || null;
  if (draft.datesText.trim() !== before.datesText)
    request.datesText = draft.datesText.trim() || null;
  if (draft.ownerId !== before.ownerId) request.ownerId = draft.ownerId;
  return Object.keys(request).length > 0 ? request : null;
}

/** Who edits a list: its owner or a super admin (Q-T1; the API answers 403 `task_list_forbidden` otherwise). */
export function v2CanEditTaskList(
  list: V2TaskList,
  user: { readonly id: string | null; readonly isSuperAdmin: boolean },
): boolean {
  return user.isSuperAdmin || (user.id !== null && list.owner?.id === user.id);
}

export type V2TaskDateChipKey = 'today' | 'tomorrow' | 'nextMonday' | 'inWeek';

export interface V2TaskDateChip {
  readonly key: V2TaskDateChipKey;
  readonly date: Date;
}

/**
 * Quick dates of New task (board `QUICK`): Today · Tomorrow · next Monday · in a week. A chip that
 * would repeat an earlier date (next Monday when tomorrow is Monday) is left out. "No date" is the
 * view's own chip.
 */
export function v2TaskDateChips(now: Date): readonly V2TaskDateChip[] {
  const at = (days: number): Date =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const toMonday = (8 - now.getDay()) % 7 || 7;
  const candidates: V2TaskDateChip[] = [
    { key: 'today', date: at(0) },
    { key: 'tomorrow', date: at(1) },
    { key: 'nextMonday', date: at(toMonday) },
    { key: 'inWeek', date: at(7) },
  ];
  return candidates.filter(
    (chip, index) =>
      candidates.findIndex((other) => other.date.getTime() === chip.date.getTime()) === index,
  );
}
