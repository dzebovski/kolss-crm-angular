import { ROLE_SUPER_ADMIN } from '@core/roles/roles';
import { calendarDayDiff } from './date-format';
import type { V2Task, V2TaskStatus, V2TaskView } from './task.types';

/**
 * Pure rules of the Tasks page (boards `Tasks-*`, one component in 8 states): due labels,
 * grouping per view, the My day progress and which controls a row offers. The caller passes
 * `now`; calendar days are compared in the viewer's local time, like the other v2 date rules.
 */

export type V2TaskGroupKey =
  'overdue' | 'today' | 'tomorrow' | 'later' | 'nodate' | 'done' | 'progress' | 'todo';

export interface V2TaskGroup {
  readonly key: V2TaskGroupKey;
  readonly items: readonly V2Task[];
  /** My day / All tasks, group Today: items finished today, behind "Show N done today". */
  readonly doneItems: readonly V2Task[];
}

export type V2TaskDue =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'overdue';
      readonly days: number;
      readonly date: Date;
      readonly time: string | null;
    }
  | { readonly kind: 'today'; readonly time: string | null; readonly late: boolean }
  | { readonly kind: 'tomorrow'; readonly time: string | null }
  | { readonly kind: 'date'; readonly date: Date; readonly time: string | null };

/** `YYYY-MM-DD` → local midnight; `null` for anything else. */
export function v2ParseTaskDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/** Local `YYYY-MM-DD` of a moment. */
export function v2TaskIsoDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayOffset(task: V2Task, now: Date): number | null {
  const date = v2ParseTaskDate(task.dueDate);
  return date ? calendarDayDiff(date, now) : null;
}

/** An open item past its date (the API counts whole office-local days; the viewer's clock backs it up). */
export function v2TaskIsOverdue(task: V2Task, now: Date): boolean {
  if (task.status === 'done') return false;
  const offset = dayOffset(task, now);
  return task.overdueDays > 0 || (offset !== null && offset < 0);
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** What the row's right-hand column says (board `dueOf`). */
export function v2TaskDue(task: V2Task, now: Date): V2TaskDue {
  const date = v2ParseTaskDate(task.dueDate);
  const offset = dayOffset(task, now);
  if (!date || offset === null) return { kind: 'none' };
  const time = task.dueTime;
  if (v2TaskIsOverdue(task, now)) {
    return { kind: 'overdue', days: Math.max(task.overdueDays, -offset, 1), date, time };
  }
  if (offset === 0) {
    const late =
      task.status !== 'done' &&
      time !== null &&
      minutesOf(time) < now.getHours() * 60 + now.getMinutes();
    return { kind: 'today', time, late };
  }
  if (offset === 1) return { kind: 'tomorrow', time };
  return { kind: 'date', date, time };
}

/** Groups the API's feed for one view; items keep the API order (date, then time). */
export function v2GroupTasks(
  view: V2TaskView,
  tasks: readonly V2Task[],
  now: Date,
): readonly V2TaskGroup[] {
  const group = (
    key: V2TaskGroupKey,
    items: readonly V2Task[],
    doneItems: readonly V2Task[] = [],
  ): V2TaskGroup => ({ key, items, doneItems });
  const done = tasks.filter((task) => task.status === 'done');

  if (view === 'done') return [group('done', done)];
  if (view === 'list') {
    return [
      group(
        'progress',
        tasks.filter((task) => task.status === 'progress'),
      ),
      group(
        'todo',
        tasks.filter((task) => task.status === 'todo'),
      ),
      group('done', done),
    ];
  }

  const open = tasks.filter((task) => task.status !== 'done');
  const overdue = open.filter((task) => v2TaskIsOverdue(task, now));
  const rest = open.filter((task) => !v2TaskIsOverdue(task, now));
  const offsetOf = (task: V2Task): number | null => dayOffset(task, now);
  const today = rest.filter((task) => {
    const offset = offsetOf(task);
    return offset !== null && offset <= 0;
  });
  const tomorrow = rest.filter((task) => offsetOf(task) === 1);
  const later = rest.filter((task) => (offsetOf(task) ?? 0) > 1);
  const noDate = rest.filter((task) => offsetOf(task) === null);

  const groups: V2TaskGroup[] = [];
  if (view === 'my_day' || view === 'all') {
    groups.push(group('overdue', overdue), group('today', today, done));
  }
  if (view === 'upcoming' || view === 'all') {
    groups.push(group('tomorrow', tomorrow), group('later', later), group('nodate', noDate));
  }
  return groups;
}

export interface V2DayProgress {
  /** Items dated today, finished or not. */
  readonly total: number;
  readonly done: number;
  readonly overdue: number;
}

/** My day header: "N of M done today" and the red overdue pill. */
export function v2DayProgress(tasks: readonly V2Task[], now: Date): V2DayProgress {
  const today = tasks.filter((task) => dayOffset(task, now) === 0);
  return {
    total: today.length,
    done: today.filter((task) => task.status === 'done').length,
    overdue: tasks.filter((task) => v2TaskIsOverdue(task, now)).length,
  };
}

/** Which statuses the detail panel's segmented control may set (manual tasks the caller manages). */
export function v2TaskStatusChoices(task: V2Task): Record<V2TaskStatus, boolean> {
  const enabled = task.canManage && !task.automatic;
  return { todo: enabled, progress: enabled, done: enabled };
}

/** A comment reminder closes the same way the lead card's "Mark as done" does (`clear_reminder`). */
export function v2TaskClearsReminder(task: V2Task): boolean {
  return (
    task.source === 'reminder' &&
    task.subKind === 'comment' &&
    task.status !== 'done' &&
    task.link?.type === 'lead'
  );
}

/** Call-backs close through the lead's call-result popups (Q-T4). */
export function v2TaskHasCallResult(task: V2Task): boolean {
  return task.kind === 'call' && task.status !== 'done' && task.link?.type === 'lead';
}

/** The row circle: toggles a manual task, or clears a comment reminder; elsewhere it only shows. */
export function v2TaskCircleActive(task: V2Task): boolean {
  return (task.canManage && !task.automatic) || v2TaskClearsReminder(task);
}

/** Delete (soft, `status: canceled`) is offered to the creator and admins of a manual task (Q-T3). */
export function v2TaskCanDelete(
  task: V2Task,
  user: { readonly id: string | null; readonly isAdmin: boolean },
): boolean {
  if (task.automatic || !task.canEdit) return false;
  return user.isAdmin || (user.id !== null && task.createdBy?.id === user.id);
}

export interface V2TaskAssignable {
  readonly id: string;
  readonly displayName: string;
  readonly role: string;
  readonly status: string;
  readonly officeUuids: readonly string[];
}

/**
 * Who may get a task in an office: an active profile that is a member of the office, or a super
 * admin (no membership needed; owner decision 2026-09-29). Without an office every active person.
 */
export function v2AssignableEmployees<T extends V2TaskAssignable>(
  employees: readonly T[],
  officeId: string | null,
): readonly T[] {
  return employees.filter(
    (employee) =>
      employee.status === 'active' &&
      (officeId === null ||
        employee.role === ROLE_SUPER_ADMIN ||
        employee.officeUuids.includes(officeId)),
  );
}
