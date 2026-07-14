import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { UiSelect, type UiSelectOption } from './ui-select';

const options: readonly UiSelectOption[] = [
  { value: 'new', label: 'New lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal sent' },
  { value: 'won', label: 'Closed won', disabled: true },
];

@Component({
  imports: [FormField, UiSelect],
  template: `<app-ui-select
    label="Lifecycle stage"
    [options]="options"
    [formField]="stageForm.stage"
  />`,
})
class SignalFormHost {
  readonly options = options;
  readonly model = signal({ stage: 'qualified' });
  readonly stageForm = form(this.model);
}

@Component({
  imports: [UiSelect],
  template: `
    <div class="ui-modal" style="max-height: 6rem; overflow: auto">
      <p style="height: 4rem">Scroll padding</p>
      <app-ui-select label="Manager" [options]="options" [(value)]="value" />
    </div>
  `,
  styles: `
    .ui-modal {
      width: 16rem;
      padding: 1rem;
      border: 1px solid #ccc;
    }
  `,
})
class OverflowClippedHost {
  readonly options = options;
  readonly value = signal('qualified');
}

const managerOptions: readonly UiSelectOption[] = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'mgr-1', label: 'Inna Yakovenko', userId: 'mgr-1' },
  { value: 'mgr-2', label: 'Iryna Petrova', userId: 'mgr-2' },
];

@Component({
  imports: [UiSelect],
  template: `<app-ui-select label="Manager" [options]="options" [(value)]="value" />`,
})
class ManagerSelectHost {
  readonly options = managerOptions;
  readonly value = signal('mgr-1');
}

function queryOverlayOptions(overlayContainer: OverlayContainer): HTMLElement[] {
  return Array.from(
    overlayContainer.getContainerElement().querySelectorAll<HTMLElement>('[role="option"]'),
  );
}

function queryOverlayListbox(overlayContainer: OverlayContainer): HTMLElement | null {
  return overlayContainer.getContainerElement().querySelector<HTMLElement>('[role="listbox"]');
}

describe('UiSelect', () => {
  afterEach(() => {
    const overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainer.ngOnDestroy();
  });

  it('opens with neutral inactive options and marks the selected option', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;

    const trigger = element.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const renderedOptions = queryOverlayOptions(overlayContainer);
    const listbox = queryOverlayListbox(overlayContainer);
    const inactiveOption = renderedOptions.find((option) => option.dataset['active'] === 'false');
    const selectedOption = renderedOptions.find(
      (option) => option.getAttribute('aria-selected') === 'true',
    );

    expect(renderedOptions).toHaveLength(options.length);
    expect(listbox?.getAttribute('tabindex')).toBe('0');
    expect(renderedOptions.every((option) => option.getAttribute('tabindex') === '-1')).toBe(true);
    expect(inactiveOption).toBeDefined();
    expect(inactiveOption?.matches('[data-active="true"]')).toBe(false);
    expect(selectedOption?.textContent).toContain('Qualified');
    expect(selectedOption?.querySelector('app-ui-icon')).not.toBeNull();
  });

  it('selects an option and updates the Signal Form model', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;

    const trigger = element.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const proposalOption = queryOverlayOptions(overlayContainer).find((option) =>
      option.textContent?.includes('Proposal sent'),
    );
    proposalOption?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().stage).toBe('proposal');
    expect(trigger.textContent).toContain('Proposal sent');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not select a disabled option', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
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

    expect(fixture.componentInstance.model().stage).toBe('qualified');
  });

  it('exposes the soft-disabled state and does not open', async () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps a stable message slot when validation text appears', async () => {
    const fixture = TestBed.createComponent(UiSelect);
    fixture.componentRef.setInput('options', options);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('button');
    const emptyMessage = element.querySelector('.ui-select__message');

    expect(emptyMessage?.getAttribute('aria-hidden')).toBe('true');
    expect(trigger?.getAttribute('aria-describedby')).toBeNull();

    fixture.componentRef.setInput('error', 'Select a stage');
    await fixture.whenStable();

    const errorMessage = element.querySelector('.ui-select__message');
    expect(errorMessage).toBe(emptyMessage);
    expect(errorMessage?.getAttribute('role')).toBe('alert');
    expect(errorMessage?.textContent).toContain('Select a stage');
    expect(trigger?.getAttribute('aria-describedby')).toBe(errorMessage?.id);
  });

  it('renders options outside an overflow-clipped modal ancestor', async () => {
    const fixture = TestBed.createComponent(OverflowClippedHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;
    const modal = element.querySelector('.ui-modal') as HTMLElement;
    const trigger = element.querySelector('button') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const listbox = queryOverlayListbox(overlayContainer);
    const overlayPane = overlayContainer
      .getContainerElement()
      .querySelector('.ui-select__overlay-pane');
    const renderedOptions = queryOverlayOptions(overlayContainer);

    expect(listbox).not.toBeNull();
    expect(overlayPane).not.toBeNull();
    expect(modal.contains(listbox)).toBe(false);
    expect(modal.contains(overlayPane)).toBe(false);
    expect(renderedOptions).toHaveLength(options.length);
  });

  it('renders user avatars for options with userId and plain labels without', async () => {
    const fixture = TestBed.createComponent(ManagerSelectHost);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('button') as HTMLButtonElement;

    expect(trigger.querySelector('app-ui-user')).not.toBeNull();
    expect(trigger.textContent).toContain('Inna Yakovenko');

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const renderedOptions = queryOverlayOptions(overlayContainer);
    const unassigned = renderedOptions.find((option) =>
      option.textContent?.includes('Unassigned'),
    );
    const manager = renderedOptions.find((option) =>
      option.textContent?.includes('Inna Yakovenko'),
    );

    expect(unassigned?.querySelector('app-ui-user')).toBeNull();
    expect(manager?.querySelector('app-ui-user')).not.toBeNull();
  });
});
