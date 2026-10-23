import type { V2Task } from './task.types';
import {
  v2AssignableEmployees,
  v2DayProgress,
  v2GroupTasks,
  v2ParseTaskDate,
  v2TaskCanDelete,
  v2TaskCircleActive,
  v2TaskClearsReminder,
  v2TaskDue,
  v2TaskIsOverdue,
} from './task-view';

// Fri 25 Sep 2026, 14:30.
const NOW = new Date(2026, 8, 25, 14, 30);

const task = (patch: Partial<V2Task> = {}): V2Task => ({
  id: 'manual:t',
  sourceId: 't',
  source: 'manual',
  kind: 'personal',
  subKind: 'task',
  title: 'Task',
  note: '',
  status: 'todo',
  dueDate: '2026-09-25',
  dueTime: null,
  overdueDays: 0,
  officeId: 'o1',
  officeCode: 'warsaw',
  assignee: { id: 'u1', name: 'Kasia' },
  createdBy: { id: 'u1', name: 'Kasia' },
  link: null,
  list: null,
  version: 1,
  canManage: true,
  canEdit: true,
  automatic: false,
  ...patch,
});

describe('v2ParseTaskDate', () => {
  it('parses a date and rejects impossible ones', () => {
    expect(v2ParseTaskDate('2026-09-25')?.getDate()).toBe(25);
    expect(v2ParseTaskDate('2026-02-31')).toBeNull();
    expect(v2ParseTaskDate(null)).toBeNull();
  });
});

describe('v2TaskDue', () => {
  it('has no label without a date', () => {
    expect(v2TaskDue(task({ dueDate: null }), NOW)).toEqual({ kind: 'none' });
  });

  it('counts overdue days from the API or the clock, never for a done task', () => {
    expect(v2TaskDue(task({ dueDate: '2026-09-22', overdueDays: 3 }), NOW)).toMatchObject({
      kind: 'overdue',
      days: 3,
    });
    expect(v2TaskDue(task({ dueDate: '2026-09-24' }), NOW)).toMatchObject({
      kind: 'overdue',
      days: 1,
    });
    expect(v2TaskDue(task({ dueDate: '2026-09-24', status: 'done' }), NOW).kind).toBe('date');
  });

  it('marks a passed time today as late', () => {
    expect(v2TaskDue(task({ dueTime: '11:00' }), NOW)).toEqual({
      kind: 'today',
      time: '11:00',
      late: true,
    });
    expect(v2TaskDue(task({ dueTime: '16:30' }), NOW)).toMatchObject({ late: false });
    expect(v2TaskDue(task({ dueTime: '11:00', status: 'done' }), NOW)).toMatchObject({
      late: false,
    });
  });

  it('labels tomorrow and later dates', () => {
    expect(v2TaskDue(task({ dueDate: '2026-09-26', dueTime: '10:00' }), NOW)).toEqual({
      kind: 'tomorrow',
      time: '10:00',
    });
    expect(v2TaskDue(task({ dueDate: '2026-10-05' }), NOW).kind).toBe('date');
  });
});

describe('v2GroupTasks', () => {
  const overdue = task({ id: 'a', dueDate: '2026-09-22', overdueDays: 3 });
  const today = task({ id: 'b' });
  const doneToday = task({ id: 'c', status: 'done' });
  const tomorrow = task({ id: 'd', dueDate: '2026-09-26' });
  const later = task({ id: 'e', dueDate: '2026-10-09' });
  const none = task({ id: 'f', dueDate: null });
  const ids = (items: readonly V2Task[]): string[] => items.map((item) => item.id);

  it('splits My day into Overdue and Today with the done ones tucked away', () => {
    const groups = v2GroupTasks('my_day', [overdue, today, doneToday], NOW);
    expect(groups.map((group) => group.key)).toEqual(['overdue', 'today']);
    expect(ids(groups[0].items)).toEqual(['a']);
    expect(ids(groups[1].items)).toEqual(['b']);
    expect(ids(groups[1].doneItems)).toEqual(['c']);
  });

  it('splits Upcoming into Tomorrow, Later and No date', () => {
    const groups = v2GroupTasks('upcoming', [tomorrow, later, none], NOW);
    expect(groups.map((group) => [group.key, ids(group.items)])).toEqual([
      ['tomorrow', ['d']],
      ['later', ['e']],
      ['nodate', ['f']],
    ]);
  });

  it('shows every group in All tasks', () => {
    const groups = v2GroupTasks('all', [overdue, today, tomorrow, later, none], NOW);
    expect(groups.map((group) => group.key)).toEqual([
      'overdue',
      'today',
      'tomorrow',
      'later',
      'nodate',
    ]);
  });

  it('puts a list into In progress, To do and Done', () => {
    const progress = task({ id: 'p', status: 'progress' });
    const groups = v2GroupTasks('list', [today, progress, doneToday], NOW);
    expect(groups.map((group) => [group.key, ids(group.items)])).toEqual([
      ['progress', ['p']],
      ['todo', ['b']],
      ['done', ['c']],
    ]);
  });

  it('keeps one Done group for the Done view', () => {
    const groups = v2GroupTasks('done', [doneToday], NOW);
    expect(groups.map((group) => group.key)).toEqual(['done']);
  });
});

describe('v2DayProgress', () => {
  it('counts today’s items and the overdue ones', () => {
    const progress = v2DayProgress(
      [
        task({ id: 'a', dueDate: '2026-09-22', overdueDays: 3 }),
        task({ id: 'b' }),
        task({ id: 'c', status: 'done' }),
        task({ id: 'd', dueDate: '2026-09-26' }),
      ],
      NOW,
    );
    expect(progress).toEqual({ total: 2, done: 1, overdue: 1 });
  });
});

describe('row controls', () => {
  const reminder = task({
    source: 'reminder',
    kind: 'comment',
    subKind: 'comment',
    automatic: true,
    canManage: false,
    canEdit: false,
    link: { type: 'lead', id: 'l1', name: 'Marta', code: 'W0231', phone: null },
  });

  it('lets the circle act on manual tasks and comment reminders only', () => {
    expect(v2TaskCircleActive(task())).toBe(true);
    expect(v2TaskCircleActive(task({ canManage: false }))).toBe(false);
    expect(v2TaskClearsReminder(reminder)).toBe(true);
    expect(v2TaskCircleActive(reminder)).toBe(true);
    expect(
      v2TaskCircleActive(task({ source: 'appointment', kind: 'visit', automatic: true })),
    ).toBe(false);
  });

  it('offers Delete to the creator and admins of an editable manual task', () => {
    expect(v2TaskCanDelete(task(), { id: 'u1', isAdmin: false })).toBe(true);
    expect(v2TaskCanDelete(task(), { id: 'u2', isAdmin: false })).toBe(false);
    expect(v2TaskCanDelete(task(), { id: 'u2', isAdmin: true })).toBe(true);
    expect(v2TaskCanDelete(task({ canEdit: false }), { id: 'u1', isAdmin: true })).toBe(false);
    expect(v2TaskCanDelete(reminder, { id: 'u1', isAdmin: true })).toBe(false);
  });
});

describe('v2TaskIsOverdue', () => {
  it('ignores done tasks and undated ones', () => {
    expect(v2TaskIsOverdue(task({ status: 'done', overdueDays: 2 }), NOW)).toBe(false);
    expect(v2TaskIsOverdue(task({ dueDate: null }), NOW)).toBe(false);
  });
});

describe('v2AssignableEmployees', () => {
  const people = [
    { id: 'a', displayName: 'A', role: 'office_member', status: 'active', officeUuids: ['o1'] },
    { id: 'b', displayName: 'B', role: 'office_member', status: 'active', officeUuids: ['o2'] },
    { id: 'c', displayName: 'C', role: 'super_admin', status: 'active', officeUuids: [] },
    { id: 'd', displayName: 'D', role: 'office_member', status: 'inactive', officeUuids: ['o1'] },
  ];

  it('keeps active members of the office and super admins', () => {
    expect(v2AssignableEmployees(people, 'o1').map((person) => person.id)).toEqual(['a', 'c']);
  });

  it('keeps every active person without an office', () => {
    expect(v2AssignableEmployees(people, null).map((person) => person.id)).toEqual(['a', 'b', 'c']);
  });
});
