import { TestBed } from '@angular/core/testing';

import { KolssApiClient, KolssApiError } from '@core/api/generated/kolss-api.client';
import { AuthService } from '@core/auth/auth.service';
import { SessionService } from '@core/session/session.service';
import type { DashboardTask, ManagerTaskSection } from '@core/api/generated/kolss-api.types';
import { ManagerTaskSection as ManagerTaskSectionComponent } from './manager-task-section';

const office = {
  id: 'office-1',
  code: 'kyiv',
  nameUk: 'Київ',
  namePl: 'Kijów',
  timezoneName: 'Europe/Kyiv',
};
const task = (overrides: Partial<DashboardTask> = {}): DashboardTask => ({
  id: 'task-1',
  sourceId: 'source-1',
  source: 'manual',
  kind: 'manual',
  title: 'Follow up',
  dueAt: null,
  localDate: null,
  office,
  managerId: 'manager-1',
  leadId: null,
  leadName: null,
  phone: null,
  comment: null,
  status: 'open',
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

async function render(
  section: ManagerTaskSection = 'current',
  response: { items: readonly DashboardTask[]; nextCursor: string | null } = {
    items: [task()],
    nextCursor: null,
  },
  canManage = true,
) {
  const managerTasks = vi.fn().mockResolvedValue(response);
  const updateManagerTask = vi.fn().mockResolvedValue({});
  await TestBed.configureTestingModule({
    imports: [ManagerTaskSectionComponent],
    providers: [
      { provide: KolssApiClient, useValue: { managerTasks, updateManagerTask } },
      {
        provide: AuthService,
        useValue: {
          me: () => ({ permissions: { canManageUsers: false, canManageTasks: canManage } }),
        },
      },
      {
        provide: SessionService,
        useValue: { sessionContext: () => null, selectedOfficeId: () => null, locale: () => 'en' },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ManagerTaskSectionComponent);
  fixture.componentRef.setInput('managerId', 'manager-1');
  fixture.componentRef.setInput('section', section);
  await fixture.whenStable();
  return { fixture, managerTasks, updateManagerTask };
}

describe('ManagerTaskSection', () => {
  it('loads the section and renders a task', async () => {
    const { fixture, managerTasks } = await render();
    expect(managerTasks).toHaveBeenCalledWith({
      officeId: null,
      managerId: 'manager-1',
      section: 'current',
      cursor: null,
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Follow up');
  });

  it('completes, cancels, and restores manual tasks through the API', async () => {
    const { fixture, updateManagerTask } = await render();
    const component = fixture.componentInstance as unknown as {
      changeStatus: (task: DashboardTask, status: 'done' | 'canceled' | 'open') => Promise<void>;
    };
    await component.changeStatus(task(), 'done');
    await fixture.whenStable();
    await component.changeStatus(task(), 'canceled');
    await fixture.whenStable();
    expect(updateManagerTask).toHaveBeenNthCalledWith(1, 'source-1', 1, 'done');
    expect(updateManagerTask).toHaveBeenNthCalledWith(2, 'source-1', 1, 'canceled');

    fixture.componentRef.setInput('section', 'done');
    await fixture.whenStable();
    const historyComponent = fixture.componentInstance as unknown as {
      changeStatus: (task: DashboardTask, status: 'open') => Promise<void>;
    };
    await historyComponent.changeStatus(task({ status: 'done' }), 'open');
    await fixture.whenStable();
    expect(updateManagerTask).toHaveBeenCalledWith('source-1', 1, 'open');
  });

  it('keeps the row and reports a failed status mutation', async () => {
    const { fixture, updateManagerTask } = await render();
    updateManagerTask.mockRejectedValueOnce(new Error('failed'));
    const checkbox = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '.task-check',
    )!;
    checkbox.click();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not save task');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Follow up');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.task-check')
        ?.checked,
    ).toBe(false);
  });

  it('hides status controls when the user cannot manage tasks', async () => {
    const { fixture } = await render('current', { items: [task()], nextCursor: null }, false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.task-check')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.task-action')).toBeNull();
  });

  it('emits a refresh on a 409 conflict', async () => {
    const { fixture, updateManagerTask } = await render();
    updateManagerTask.mockRejectedValueOnce(new KolssApiError('stale', 'stale', 409));
    const changed = vi.spyOn(fixture.componentInstance.changed, 'emit');
    const component = fixture.componentInstance as unknown as {
      changeStatus: (task: DashboardTask, status: 'canceled') => Promise<void>;
    };
    await component.changeStatus(task(), 'canceled');
    await fixture.whenStable();
    expect(changed).toHaveBeenCalledOnce();
  });

  it('paginates without duplicating a task', async () => {
    const response = { items: [task()], nextCursor: 'next' };
    const { fixture, managerTasks } = await render('future', response);
    const component = fixture.componentInstance as unknown as {
      load: (append?: boolean) => Promise<void>;
      cursor: { set(value: string | null): void };
    };
    component.cursor.set('next');
    managerTasks.mockResolvedValue({
      items: [task(), task({ id: 'task-2', sourceId: 'source-2', title: 'Second' })],
      nextCursor: null,
    });
    await component.load(true);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li')).toHaveLength(2);
  });

  it('ignores a stale response after the section scope changes', async () => {
    let resolve!: (value: { items: readonly DashboardTask[]; nextCursor: null }) => void;
    const pending = new Promise<{ items: readonly DashboardTask[]; nextCursor: null }>(
      (done) => (resolve = done),
    );
    const managerTasks = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ items: [], nextCursor: null });
    await TestBed.configureTestingModule({
      imports: [ManagerTaskSectionComponent],
      providers: [
        { provide: KolssApiClient, useValue: { managerTasks, updateManagerTask: vi.fn() } },
        {
          provide: AuthService,
          useValue: { me: () => ({ permissions: { canManageTasks: true } }) },
        },
        {
          provide: SessionService,
          useValue: {
            sessionContext: () => null,
            selectedOfficeId: () => null,
            locale: () => 'en',
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ManagerTaskSectionComponent);
    fixture.componentRef.setInput('managerId', 'manager-1');
    fixture.componentRef.setInput('section', 'current');
    await fixture.whenStable();
    fixture.componentRef.setInput('managerId', 'manager-2');
    await fixture.whenStable();
    resolve({ items: [task()], nextCursor: null });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Follow up');
  });
});
