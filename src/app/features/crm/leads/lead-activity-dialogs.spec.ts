import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import axe from 'axe-core';

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

  it('shows an optional due date field when allowDueDate is enabled', async () => {
    dialog.open(TextActivityDialog, {
      data: {
        eyebrow: 'Нотатка менеджера',
        title: 'Додати коментар',
        description: 'Коментар не змінює статуси.',
        placeholder: 'Коментар',
        submitLabel: 'Додати',
        allowDueDate: true,
      },
      ariaLabelledBy: 'text-activity-title',
      enterAnimationDuration: 0,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(overlay.querySelector('input[type="date"]')).toBeTruthy();
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
