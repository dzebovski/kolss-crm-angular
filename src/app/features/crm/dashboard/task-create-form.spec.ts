import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { TaskCreateForm } from './task-create-form';

const offices = [
  { id: 'office-1', code: 'kyiv', name_uk: 'Київ', name_pl: 'Kijów', is_active: true },
];

async function render(createManagerTask = vi.fn().mockResolvedValue({})) {
  await TestBed.configureTestingModule({
    imports: [TaskCreateForm],
    providers: [{ provide: KolssApiClient, useValue: { createManagerTask } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(TaskCreateForm);
  fixture.componentRef.setInput('managerId', 'manager-1');
  fixture.componentRef.setInput('offices', offices);
  await fixture.whenStable();
  return { fixture, createManagerTask };
}

describe('TaskCreateForm', () => {
  it('rejects an empty title without calling the API', async () => {
    const { fixture, createManagerTask } = await render();
    const component = fixture.componentInstance as unknown as { save: () => Promise<void> };
    await component.save();
    await fixture.whenStable();
    expect(createManagerTask).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a task');
  });

  it('reuses the same idempotency key when retrying the same failed create', async () => {
    const createManagerTask = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({});
    const { fixture } = await render(createManagerTask);
    const component = fixture.componentInstance as unknown as {
      model: { set(value: { title: string; dueDate: string; officeId: string }): void };
      save: () => Promise<void>;
    };
    component.model.set({ title: 'Call client', dueDate: '', officeId: 'office-1' });
    await component.save();
    await fixture.whenStable();
    await component.save();
    await fixture.whenStable();
    expect(createManagerTask).toHaveBeenCalledTimes(2);
    expect(createManagerTask.mock.calls[0]![1]).toBe(createManagerTask.mock.calls[1]![1]);
  });

  it('emits created after a successful manual task create', async () => {
    const { fixture, createManagerTask } = await render();
    const created = vi.spyOn(fixture.componentInstance.created, 'emit');
    const component = fixture.componentInstance as unknown as {
      model: { set(value: { title: string; dueDate: string; officeId: string }): void };
      save: () => Promise<void>;
    };
    component.model.set({ title: 'Call client', dueDate: '2026-09-10', officeId: 'office-1' });
    await component.save();
    await fixture.whenStable();
    expect(createManagerTask).toHaveBeenCalledWith(
      {
        officeId: 'office-1',
        assigneeId: 'manager-1',
        title: 'Call client',
        dueDate: '2026-09-10',
      },
      expect.any(String),
    );
    expect(created).toHaveBeenCalledOnce();
  });
});
