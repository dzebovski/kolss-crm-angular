import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogState } from '@angular/material/dialog';
import axe from 'axe-core';
import { firstValueFrom } from 'rxjs';

import { RadialActionDialog } from './radial-action-dialog';
import { RADIAL_DEMO_VARIANTS } from './radial-menu.types';

describe('RadialActionDialog', () => {
  let dialog: MatDialog;
  let overlayContainer: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    dialog = TestBed.inject(MatDialog);
    overlayContainer = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    dialog.closeAll();
    overlayContainer.innerHTML = '';
  });

  async function openSevenActionDialog() {
    const variant = RADIAL_DEMO_VARIANTS.find((item) => item.id === 'seven-actions')!;
    const dialogRef = dialog.open<RadialActionDialog, unknown, string>(RadialActionDialog, {
      data: {
        title: variant.title,
        actions: variant.actions,
      },
      panelClass: 'radial-menu-dialog-panel',
      ariaLabel: variant.title,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return dialogRef;
  }

  it('renders arbitrary configured actions on the same orbit and returns their id', async () => {
    const dialogRef = await openSevenActionDialog();
    const selector = overlayContainer.querySelector('.radial-selector') as HTMLElement;
    const actions = Array.from(overlayContainer.querySelectorAll<HTMLElement>('.radial-action'));

    expect(actions).toHaveLength(7);
    expect(selector.classList).toContain('radial-selector--mobile-list');

    const radius = Number.parseFloat(selector.style.getPropertyValue('--radial-radius'));
    for (const action of actions) {
      const x = Number.parseFloat(action.style.getPropertyValue('--radial-x'));
      const y = Number.parseFloat(action.style.getPropertyValue('--radial-y'));
      expect(Math.hypot(x, y)).toBeCloseTo(radius, 3);
    }

    const result = firstValueFrom(dialogRef.afterClosed());
    (
      overlayContainer.querySelector(
        '[data-testid="radial-action-invalid_number"]',
      ) as HTMLButtonElement
    ).click();
    expect(await result).toBe('invalid_number');
  });

  it('has no automated accessibility violations with seven actions', async () => {
    await openSevenActionDialog();

    const results = await axe.run(overlayContainer);

    expect(results.violations).toEqual([]);
  });

  it('keeps disabled actions visible without allowing selection', async () => {
    const dialogRef = dialog.open<RadialActionDialog, unknown, string>(RadialActionDialog, {
      data: {
        title: 'Оберіть статус клієнта',
        actions: [
          {
            id: 'thinking',
            label: 'Думає',
            icon: 'schedule',
            tone: 'brand',
            disabled: true,
          },
        ],
      },
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const action = overlayContainer.querySelector(
      '[data-testid="radial-action-thinking"]',
    ) as HTMLButtonElement;
    expect(action.disabled).toBe(true);
    action.click();
    expect(dialogRef.getState()).toBe(MatDialogState.OPEN);
  });

  it('uses the shared semantic tones for call outcomes', () => {
    const actions = RADIAL_DEMO_VARIANTS[0]!.actions;

    expect(actions.map((action) => [action.id, action.tone])).toEqual([
      ['success', 'success'],
      ['no_answer', 'danger'],
      ['call_back', 'brand'],
    ]);
  });
});
