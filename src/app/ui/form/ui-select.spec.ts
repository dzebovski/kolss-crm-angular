import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { UiSelect, UiSelectOption } from './ui-select';

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

describe('UiSelect', () => {
  it('opens with neutral inactive options and marks the selected option', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const trigger = element.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const renderedOptions = Array.from(element.querySelectorAll<HTMLElement>('[role="option"]'));
    const listbox = element.querySelector<HTMLElement>('[role="listbox"]');
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
    const element = fixture.nativeElement as HTMLElement;

    const trigger = element.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const proposalOption = Array.from(
      element.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find((option) => option.textContent?.includes('Proposal sent'));
    proposalOption?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().stage).toBe('proposal');
    expect(trigger.textContent).toContain('Proposal sent');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not select a disabled option', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const trigger = element.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    const disabledOption = element.querySelector<HTMLElement>(
      '[role="option"][aria-disabled="true"]',
    );
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
});
