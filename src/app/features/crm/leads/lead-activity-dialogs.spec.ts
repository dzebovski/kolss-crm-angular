import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import axe from 'axe-core';
import { firstValueFrom } from 'rxjs';

import { SessionService } from '../../../core/session/session.service';
import { DueDateDialog, TextActivityDialog } from './lead-activity-dialogs';

describe('lead activity dialogs', () => {
  let dialog: MatDialog;
  let overlay: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SessionService, useValue: { locale: () => 'uk' } }],
    });
    dialog = TestBed.inject(MatDialog);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    dialog.closeAll();
    overlay.innerHTML = '';
  });

  it('keeps submit disabled while the required comment is empty', async () => {
    dialog.open(TextActivityDialog, {
      data: {
        eyebrow: 'Успішний дзвінок',
        title: 'Підсумок',
        description: 'Додайте контекст.',
        placeholder: 'Коментар',
        submitLabel: 'Зберегти',
      },
      ariaLabelledBy: 'text-activity-title',
      autoFocus: 'first-tabbable',
      enterAnimationDuration: 0,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(overlay.querySelector('textarea')).toBeTruthy();
    expect(overlay.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it('requires a date for a callback reminder', async () => {
    dialog.open(DueDateDialog, {
      data: { statusLabel: 'Передзвонити' },
      ariaLabelledBy: 'due-date-title',
      enterAnimationDuration: 0,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const input = overlay.querySelector<HTMLInputElement>('input[type="date"]')!;
    const submit = overlay.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);

    input.value = '2026-07-25';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(submit.disabled).toBe(false);
  });

  it('prefills an optional showroom date and allows clearing it', async () => {
    const ref = dialog.open(DueDateDialog, {
      data: {
        statusLabel: 'Запрошено в салон',
        required: false,
        initialDate: '2026-08-03',
      },
      ariaLabelledBy: 'due-date-title',
      enterAnimationDuration: 0,
    });
    const closed = firstValueFrom(ref.afterClosed());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const input = overlay.querySelector<HTMLInputElement>('input[type="date"]')!;
    const submit = overlay.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(input.value).toBe('2026-08-03');
    expect(submit.disabled).toBe(false);
    expect(overlay.textContent).toContain('необов’язково');

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    submit.click();

    await expect(closed).resolves.toBe('');
  });

  it('shows an optional due date field when allowDueDate is enabled', async () => {
    const ref = dialog.open(TextActivityDialog, {
      data: {
        eyebrow: 'Думає',
        title: 'Зафіксувати паузу',
        description: 'За потреби додайте контекст.',
        placeholder: 'Коментар',
        submitLabel: 'Зберегти',
        commentOptional: true,
        allowDueDate: true,
      },
      ariaLabelledBy: 'text-activity-title',
      enterAnimationDuration: 0,
    });
    const closed = firstValueFrom(ref.afterClosed());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(overlay.querySelector('input[type="date"]')).toBeTruthy();
    expect(overlay.textContent).toContain('Коментар (необов’язково)');
    expect(overlay.textContent).toContain('Дата наступної дії (необов’язково)');

    const submit = overlay.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(false);
    submit.click();

    await expect(closed).resolves.toEqual({ comment: '' });
  });

  it('requires a next-action date once a manager is assigned', async () => {
    const ref = dialog.open(TextActivityDialog, {
      data: {
        eyebrow: 'Нотатка менеджера',
        title: 'Додати коментар',
        description: 'Коментар не змінює статуси.',
        placeholder: 'Коментар',
        submitLabel: 'Додати',
        allowDueDate: true,
        allowManager: true,
        managerOptions: [
          { value: '', label: 'Не призначено' },
          { value: 'emp-kyiv-1', label: 'Данило Мороз', userId: 'emp-kyiv-1' },
        ],
      },
      ariaLabelledBy: 'text-activity-title',
      enterAnimationDuration: 0,
    });
    const closed = firstValueFrom(ref.afterClosed());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(overlay.querySelector('app-ui-select')).toBeTruthy();
    expect(overlay.textContent).toContain('Призначити менеджеру');

    const instance = ref.componentInstance;
    instance['model'].set({
      comment: 'Підготувати кошторис',
      dueDate: '',
      assignedTo: 'emp-kyiv-1',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(overlay.textContent).not.toContain('Дата наступної дії (необов’язково)');
    expect(overlay.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    instance['model'].set({
      comment: 'Підготувати кошторис',
      dueDate: '2026-07-25',
      assignedTo: 'emp-kyiv-1',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const submit = overlay.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(false);
    submit.click();

    await expect(closed).resolves.toEqual({
      comment: 'Підготувати кошторис',
      dueDate: '2026-07-25',
      assignedTo: 'emp-kyiv-1',
    });
  });

  it('has no automated accessibility violations', async () => {
    dialog.open(TextActivityDialog, {
      data: {
        eyebrow: 'Нотатка менеджера',
        title: 'Додати коментар',
        description: 'Коментар не змінює статуси.',
        placeholder: 'Коментар',
        submitLabel: 'Додати',
      },
      ariaLabelledBy: 'text-activity-title',
      enterAnimationDuration: 0,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const result = await axe.run(overlay, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
