import type { TaskFeedItem, TaskList } from '@core/api/generated/kolss-api.types';
import { toV2Task, toV2TaskList } from './task.mapper';

const office = {
  id: 'office-1',
  code: 'warsaw',
  nameUk: 'Варшава',
  namePl: 'Warszawa',
  timezoneName: 'Europe/Warsaw',
};

const item = (patch: Partial<TaskFeedItem> = {}): TaskFeedItem => ({
  id: 'manual:t1',
  sourceId: 't1',
  source: 'manual',
  kind: 'personal',
  subKind: 'task',
  title: ' Update price tags ',
  note: null,
  status: 'open',
  inProgress: false,
  dueDate: '2026-09-25',
  dueTime: null,
  dueAt: '2026-09-25T00:00:00Z',
  overdueDays: 0,
  office,
  assigneeId: 'u1',
  assigneeName: 'Kasia Nowak',
  createdById: 'u1',
  createdByName: 'Kasia Nowak',
  link: null,
  list: null,
  version: 3,
  canManage: true,
  canEdit: true,
  updatedAt: '2026-09-25T08:00:00Z',
  ...patch,
});

describe('toV2Task', () => {
  it('maps an open manual task and trims text', () => {
    const task = toV2Task(item());
    expect(task).toMatchObject({
      title: 'Update price tags',
      note: '',
      status: 'todo',
      automatic: false,
      officeId: 'office-1',
      assignee: { id: 'u1', name: 'Kasia Nowak' },
    });
  });

  it('shows in progress only for an open task and done over it', () => {
    expect(toV2Task(item({ inProgress: true })).status).toBe('progress');
    expect(toV2Task(item({ status: 'done', inProgress: true })).status).toBe('done');
  });

  it('marks everything but a manual task automatic and upper-cases the lead code', () => {
    const task = toV2Task(
      item({
        source: 'reminder',
        kind: 'call',
        subKind: 'callback',
        title: null,
        version: null,
        canManage: false,
        canEdit: false,
        link: { type: 'lead', id: 'l1', name: 'Marta', code: 'w0231', phone: '+48 601 334 812' },
      }),
    );
    expect(task.automatic).toBe(true);
    expect(task.title).toBe('');
    expect(task.link?.code).toBe('W0231');
  });

  it('keeps an unassigned task without a person', () => {
    expect(toV2Task(item({ assigneeId: null, assigneeName: null })).assignee).toBeNull();
  });
});

describe('toV2TaskList', () => {
  it('maps members and blanks absent text', () => {
    const list: TaskList = {
      id: 'l1',
      name: 'Expo',
      description: null,
      datesText: ' 12–15 Nov 2026 ',
      ownerId: null,
      ownerName: null,
      color: '#6d4ab8',
      version: 2,
      taskCount: 5,
      doneCount: 2,
      overdueCount: 1,
      members: [{ id: 'u1', displayName: 'Kasia' }],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };
    expect(toV2TaskList(list)).toMatchObject({
      description: '',
      datesText: '12–15 Nov 2026',
      owner: null,
      members: [{ id: 'u1', name: 'Kasia' }],
    });
  });
});
