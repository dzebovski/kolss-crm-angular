import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import axe from 'axe-core';

import { SessionService } from '../../../core/session/session.service';
import { TextActivityDialog } from './lead-activity-dialogs';

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
