import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiMultiSelect, type UiMultiSelectOption } from './ui-multi-select';

const options: readonly UiMultiSelectOption[] = [
  { value: 'reached', label: 'Reached' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'callback_requested', label: 'Callback requested', disabled: true },
];

@Component({
  imports: [UiMultiSelect],
  template: `
    <app-ui-multi-select
      label="Call status"
      [options]="options"
      [selectedSummaryLabel]="summaryLabel"
      [(value)]="value"
    />
  `,
})
class MultiSelectHost {
  readonly options = options;
  readonly value = signal<readonly string[]>([]);
  readonly summaryLabel = (count: number) => `${count} selected`;
}

function queryOverlayOptions(overlayContainer: OverlayContainer): HTMLElement[] {
  return Array.from(
    overlayContainer.getContainerElement().querySelectorAll<HTMLElement>('[role="option"]'),
  );
}

function queryOverlayListbox(overlayContainer: OverlayContainer): HTMLElement | null {
  return overlayContainer.getContainerElement().querySelector<HTMLElement>('[role="listbox"]');
}

describe('UiMultiSelect', () => {
  afterEach(() => {
    const overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainer.ngOnDestroy();
  });

  it('opens with aria-multiselectable and no options checked', async () => {
    const fixture = TestBed.createComponent(MultiSelectHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;

    const trigger = element.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const listbox = queryOverlayListbox(overlayContainer);
    const renderedOptions = queryOverlayOptions(overlayContainer);

    expect(listbox?.getAttribute('aria-multiselectable')).toBe('true');
    expect(renderedOptions).toHaveLength(options.length);
    expect(
      renderedOptions.every((option) => option.getAttribute('aria-selected') === 'false'),
    ).toBe(true);
  });

  it('selecting a second option adds to the array and keeps the popup open', async () => {
    const fixture = TestBed.createComponent(MultiSelectHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('button') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const renderedOptions = queryOverlayOptions(overlayContainer);
    const reached = renderedOptions.find((option) => option.textContent?.includes('Reached'));
    reached?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toEqual(['reached']);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const noAnswer = queryOverlayOptions(overlayContainer).find((option) =>
      option.textContent?.includes('No answer'),
    );
    noAnswer?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toEqual(['reached', 'no_answer']);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not select a disabled option', async () => {
    const fixture = TestBed.createComponent(MultiSelectHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('button') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const disabledOption = overlayContainer
      .getContainerElement()
      .querySelector<HTMLElement>('[role="option"][aria-disabled="true"]');
    expect(disabledOption).not.toBeNull();
    disabledOption?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toEqual([]);
  });

  it('shows placeholder, single label, and a summary for 0/1/2+ selections', async () => {
    const fixture = TestBed.createComponent(MultiSelectHost);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(trigger.textContent).toContain('Select options');

    fixture.componentInstance.value.set(['reached']);
    await fixture.whenStable();
    expect(trigger.textContent).toContain('Reached');

    fixture.componentInstance.value.set(['reached', 'no_answer']);
    await fixture.whenStable();
    expect(trigger.textContent).toContain('2 selected');
  });

  it('closes on outside click', async () => {
    const fixture = TestBed.createComponent(MultiSelectHost);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    document.body.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
