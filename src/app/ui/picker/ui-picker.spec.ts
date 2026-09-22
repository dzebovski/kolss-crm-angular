import axe from 'axe-core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UiPicker, type UiPickerOption } from './ui-picker';

const options: readonly UiPickerOption[] = [
  { value: 'all', label: 'All offices' },
  { value: 'kyiv', label: 'Kyiv', leading: '🇺🇦' },
  { value: 'warsaw', label: 'Warsaw', leading: '🇵🇱' },
  { value: 'disabled', label: 'Disabled office', disabled: true },
];

@Component({
  imports: [UiPicker],
  template: `
    <app-ui-picker
      ariaLabel="Office context"
      [options]="options"
      [(value)]="value"
      [disabled]="disabled()"
    />
  `,
})
class PickerHost {
  readonly options = options;
  readonly value = signal('warsaw');
  readonly disabled = signal(false);
}

function overlayOptions(overlayContainer: OverlayContainer): HTMLElement[] {
  return Array.from(
    overlayContainer.getContainerElement().querySelectorAll<HTMLElement>('[role="option"]'),
  );
}

describe('UiPicker', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  it('renders the selected label and decorative leading marker', async () => {
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const leading = trigger.querySelector('.ui-picker__leading');

    expect(trigger.getAttribute('aria-label')).toBe('Office context');
    expect(trigger.textContent).toContain('Warsaw');
    expect(trigger.textContent).toContain('🇵🇱');
    expect(leading?.getAttribute('aria-hidden')).toBe('true');
    expect(trigger.querySelector('app-ui-icon')).not.toBeNull();
  });

  it('opens the listbox, selects an option, closes, and restores trigger focus', async () => {
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const listbox = overlayContainer
      .getContainerElement()
      .querySelector<HTMLElement>('[role="listbox"]');
    const renderedOptions = overlayOptions(overlayContainer);
    const selected = renderedOptions.find(
      (option) => option.getAttribute('aria-selected') === 'true',
    );

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(listbox?.getAttribute('aria-label')).toBe('Office context');
    expect(renderedOptions).toHaveLength(options.length);
    expect(selected?.textContent).toContain('Warsaw');

    renderedOptions.find((option) => option.textContent?.includes('Kyiv'))?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('kyiv');
    expect(trigger.textContent).toContain('Kyiv');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('does not select a disabled option', async () => {
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    trigger.click();
    await fixture.whenStable();

    const disabledOption = overlayOptions(overlayContainer).find(
      (option) => option.getAttribute('aria-disabled') === 'true',
    );
    disabledOption?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBe('warsaw');
  });

  it('does not open when disabled', async () => {
    const fixture = TestBed.createComponent(PickerHost);
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.click();
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens from the keyboard and closes on Escape', async () => {
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();

    const listbox = overlayContainer
      .getContainerElement()
      .querySelector<HTMLElement>('[role="listbox"]');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(listbox).not.toBeNull();

    listbox?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when clicking outside the overlay', async () => {
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    trigger.click();
    await fixture.whenStable();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('has no automated accessibility violations when open', async () => {
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    trigger.click();
    await fixture.whenStable();

    expect((await axe.run(fixture.nativeElement as HTMLElement)).violations).toEqual([]);
    expect((await axe.run(overlayContainer.getContainerElement())).violations).toEqual([]);
  });
});
