import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';

import { RadialMenuPage } from './radial-menu-page';

describe('RadialMenuPage', () => {
  let overlayContainer: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    overlayContainer = TestBed.inject(OverlayContainer).getContainerElement();
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    overlayContainer.innerHTML = '';
  });

  async function setup() {
    const fixture = TestBed.createComponent(RadialMenuPage);
    await fixture.whenStable();
    return fixture;
  }

  async function openRadialMenu(fixture: Awaited<ReturnType<typeof setup>>) {
    const element = fixture.nativeElement as HTMLElement;
    const launcher = element.querySelector('[data-testid="open-radial-menu"]') as HTMLButtonElement;
    launcher.click();
    await fixture.whenStable();
  }

  async function openDemoMenu(
    fixture: Awaited<ReturnType<typeof setup>>,
    variantId: 'five-actions' | 'seven-actions',
  ) {
    const element = fixture.nativeElement as HTMLElement;
    const launcher = element.querySelector(
      `[data-testid="open-radial-demo-${variantId}"]`,
    ) as HTMLButtonElement;
    launcher.click();
    await fixture.whenStable();
  }

  async function settleDialog(fixture: Awaited<ReturnType<typeof setup>>) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  it('updates the mock lead immediately for outcomes that need no comment', async () => {
    const fixture = await setup();
    await openRadialMenu(fixture);

    const missedAction = overlayContainer.querySelector(
      '[data-testid="radial-action-no_answer"]',
    ) as HTMLButtonElement;
    missedAction.click();
    await settleDialog(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const status = element.querySelector('[data-testid="lead-status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('Не дозвонилися');
  });

  it('requires a comment before applying a successful outcome', async () => {
    const fixture = await setup();
    await openRadialMenu(fixture);

    (
      overlayContainer.querySelector('[data-testid="radial-action-success"]') as HTMLButtonElement
    ).click();
    await settleDialog(fixture);

    const saveButton = overlayContainer.querySelector(
      '.comment-dialog button[type="submit"]',
    ) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    const textarea = overlayContainer.querySelector(
      '.comment-dialog textarea',
    ) as HTMLTextAreaElement;
    textarea.value = 'Погодили демонстрацію на пʼятницю.';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();

    expect(saveButton.disabled).toBe(false);
    saveButton.click();
    await settleDialog(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const status = element.querySelector('[data-testid="lead-status"]') as HTMLElement;
    const comment = element.querySelector('[data-testid="lead-comment"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('Успішний');
    expect(comment.textContent).toContain('Погодили демонстрацію на пʼятницю.');
  });

  it('dismisses the radial dialog without changing the lead', async () => {
    const fixture = await setup();
    await openRadialMenu(fixture);

    (overlayContainer.querySelector('[data-testid="radial-close"]') as HTMLButtonElement).click();
    await settleDialog(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const status = element.querySelector('[data-testid="lead-status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('Новий');
    expect(overlayContainer.querySelector('.radial-selector')).toBeNull();
  });

  it('resets the local lead state', async () => {
    const fixture = await setup();
    await openRadialMenu(fixture);

    (
      overlayContainer.querySelector('[data-testid="radial-action-call_back"]') as HTMLButtonElement
    ).click();
    await settleDialog(fixture);

    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('.lead-card__topline button') as HTMLButtonElement).click();
    await fixture.whenStable();

    const status = element.querySelector('[data-testid="lead-status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('Новий');
  });

  it('opens five configured actions and stores the selected demo label locally', async () => {
    const fixture = await setup();
    await openDemoMenu(fixture, 'five-actions');

    expect(overlayContainer.querySelectorAll('.radial-action')).toHaveLength(5);
    (
      overlayContainer.querySelector(
        '[data-testid="radial-action-schedule_meeting"]',
      ) as HTMLButtonElement
    ).click();
    await settleDialog(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const fiveActionResult = element.querySelector(
      '[data-testid="radial-demo-result-five-actions"]',
    ) as HTMLElement;
    const sevenActionResult = element.querySelector(
      '[data-testid="radial-demo-result-seven-actions"]',
    ) as HTMLElement;
    expect(fiveActionResult.textContent?.trim()).toBe('Запланувати зустріч');
    expect(sevenActionResult.textContent?.trim()).toBe('Ще не обрано');
  });

  it('opens seven configured actions and dismisses without a demo result', async () => {
    const fixture = await setup();
    await openDemoMenu(fixture, 'seven-actions');

    expect(overlayContainer.querySelectorAll('.radial-action')).toHaveLength(7);
    (overlayContainer.querySelector('[data-testid="radial-close"]') as HTMLButtonElement).click();
    await settleDialog(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const result = element.querySelector(
      '[data-testid="radial-demo-result-seven-actions"]',
    ) as HTMLElement;
    expect(result.textContent?.trim()).toBe('Ще не обрано');
  });

  it('has no automated accessibility violations in the radial dialog', async () => {
    const fixture = await setup();
    await openRadialMenu(fixture);

    const results = await axe.run(overlayContainer, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(results.violations).toEqual([]);
  });
});
