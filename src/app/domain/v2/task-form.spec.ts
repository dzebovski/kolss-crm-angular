import type { V2TaskList } from './task.types';
import {
  v2CanEditTaskList,
  v2CreateListRequest,
  v2CreateTaskRequest,
  v2TaskDateChips,
  v2TaskLinkKindAvailable,
  v2TaskOfficeId,
  v2UpdateListRequest,
  v2ValidateNewList,
  v2ValidateNewTask,
  type V2NewTaskDraft,
} from './task-form';

const draft = (patch: Partial<V2NewTaskDraft> = {}): V2NewTaskDraft => ({
  title: 'Order a roll-up banner',
  linkKind: 'none',
  linkId: '',
  assigneeId: 'u1',
  date: '2026-09-26',
  time: '',
  note: '',
  ...patch,
});

describe('v2ValidateNewTask', () => {
  it('accepts a complete task', () => {
    expect(v2ValidateNewTask(draft(), '2026-09-25')).toEqual({});
  });

  it('flags the board errors', () => {
    expect(
      v2ValidateNewTask(
        draft({ title: '  ', linkKind: 'list', assigneeId: '', date: '2026-09-20' }),
        '2026-09-25',
      ),
    ).toEqual({
      title: 'titleRequired',
      link: 'linkRequired',
      assignee: 'assigneeRequired',
      date: 'datePassed',
    });
  });

  it('lets today and no date through', () => {
    expect(v2ValidateNewTask(draft({ date: '2026-09-25' }), '2026-09-25')).toEqual({});
    expect(v2ValidateNewTask(draft({ date: '' }), '2026-09-25')).toEqual({});
  });
});

describe('v2CreateTaskRequest', () => {
  it('builds a standalone task', () => {
    expect(v2CreateTaskRequest(draft({ note: '  details ' }), 'o1')).toEqual({
      officeId: 'o1',
      assigneeId: 'u1',
      title: 'Order a roll-up banner',
      dueDate: '2026-09-26',
      dueTime: null,
      note: 'details',
      listId: null,
      link: null,
    });
  });

  it('sends a time only with a date, and the list or the lead link', () => {
    expect(v2CreateTaskRequest(draft({ date: '', time: '10:00' }), 'o1').dueTime).toBeNull();
    expect(v2CreateTaskRequest(draft({ time: '10:00' }), 'o1').dueTime).toBe('10:00');
    expect(v2CreateTaskRequest(draft({ linkKind: 'list', linkId: 'L' }), 'o1')).toMatchObject({
      listId: 'L',
      link: null,
    });
    expect(v2CreateTaskRequest(draft({ linkKind: 'lead', linkId: 'X' }), 'o1')).toMatchObject({
      listId: null,
      link: { type: 'lead', id: 'X' },
    });
  });
});

describe('v2TaskOfficeId', () => {
  const base = {
    leadOfficeId: null,
    selectedOfficeId: null,
    userOfficeIds: ['o1', 'o2'],
    assigneeOfficeIds: ['o2'],
  };

  it('follows the lead, then the header office, then a shared office', () => {
    expect(v2TaskOfficeId({ ...base, leadOfficeId: 'o9', selectedOfficeId: 'o1' })).toBe('o9');
    expect(v2TaskOfficeId({ ...base, selectedOfficeId: 'o1' })).toBe('o1');
    expect(v2TaskOfficeId(base)).toBe('o2');
    expect(v2TaskOfficeId({ ...base, assigneeOfficeIds: [] })).toBe('o1');
    expect(v2TaskOfficeId({ ...base, userOfficeIds: [] })).toBeNull();
  });
});

describe('task lists', () => {
  const list: V2TaskList = {
    id: 'l1',
    name: 'Expo',
    description: 'Fair',
    datesText: '12–15 Nov 2026',
    owner: { id: 'u1', name: 'Kasia' },
    color: '#6d4ab8',
    version: 2,
    taskCount: 4,
    doneCount: 1,
    overdueCount: 0,
    members: [],
  };

  it('requires a name and an owner', () => {
    expect(v2ValidateNewList({ name: ' ', description: '', datesText: '', ownerId: '' })).toEqual({
      name: 'nameRequired',
      owner: 'ownerRequired',
    });
  });

  it('trims the create request and nulls empty text', () => {
    expect(
      v2CreateListRequest({ name: ' Expo ', description: '', datesText: ' soon ', ownerId: 'u1' }),
    ).toEqual({ name: 'Expo', description: null, datesText: 'soon', ownerId: 'u1' });
  });

  it('sends only the changed fields on edit', () => {
    const same = { name: 'Expo', description: 'Fair', datesText: '12–15 Nov 2026', ownerId: 'u1' };
    expect(v2UpdateListRequest(list, same)).toBeNull();
    expect(v2UpdateListRequest(list, { ...same, description: '', ownerId: 'u2' })).toEqual({
      description: null,
      ownerId: 'u2',
    });
  });

  it('lets the owner and a super admin edit', () => {
    expect(v2CanEditTaskList(list, { id: 'u1', isSuperAdmin: false })).toBe(true);
    expect(v2CanEditTaskList(list, { id: 'u2', isSuperAdmin: false })).toBe(false);
    expect(v2CanEditTaskList(list, { id: 'u2', isSuperAdmin: true })).toBe(true);
  });
});

describe('v2TaskLinkKindAvailable', () => {
  it('holds back client and project links until the API accepts them', () => {
    expect(v2TaskLinkKindAvailable('lead')).toBe(true);
    expect(v2TaskLinkKindAvailable('client')).toBe(false);
    expect(v2TaskLinkKindAvailable('project')).toBe(false);
  });
});

describe('v2TaskDateChips', () => {
  const keys = (now: Date): string[] => v2TaskDateChips(now).map((chip) => chip.key);

  it('offers today, tomorrow, next Monday and in a week', () => {
    // Fri 25 Sep 2026.
    const chips = v2TaskDateChips(new Date(2026, 8, 25, 14, 30));
    expect(chips.map((chip) => [chip.key, chip.date.getDate()])).toEqual([
      ['today', 25],
      ['tomorrow', 26],
      ['nextMonday', 28],
      ['inWeek', 2],
    ]);
  });

  it('drops a chip that repeats an earlier date', () => {
    // Sun 27 Sep: tomorrow is already Monday. Mon 28 Sep: next Monday is in a week.
    expect(keys(new Date(2026, 8, 27))).toEqual(['today', 'tomorrow', 'inWeek']);
    expect(keys(new Date(2026, 8, 28))).toEqual(['today', 'tomorrow', 'nextMonday']);
  });
});
