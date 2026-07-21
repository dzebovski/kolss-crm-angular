import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { UiTextField } from './ui-text-field';

@Component({
  imports: [FormField, UiTextField],
  template: `<app-ui-text-field label="Name" [formField]="nameForm.name" />`,
})
class SignalFormHost {
  readonly model = signal({ name: '' });
  readonly nameForm = form(this.model, (schema) => {
    required(schema.name, { message: 'Name is required.' });
  });
}

describe('UiTextField', () => {
  it('synchronizes with Signal Forms and reports touched state', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'Northstar';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.model().name).toBe('Northstar');
    expect(fixture.componentInstance.nameForm.name().touched()).toBe(true);
  });

  it('renders disabled and invalid states', async () => {
    const fixture = TestBed.createComponent(UiTextField);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('error', 'Invalid value');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('input')?.disabled).toBe(true);
    expect(element.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Invalid value');
  });

  it('supports date, time, and telephone input types', async () => {
    const fixture = TestBed.createComponent(UiTextField);
    fixture.componentRef.setInput('type', 'date');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('input')?.type).toBe('date');

    fixture.componentRef.setInput('type', 'time');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('input')?.type).toBe('time');

    fixture.componentRef.setInput('type', 'tel');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('input')?.type).toBe('tel');
  });

  it('keeps a stable message slot when validation text appears', async () => {
    const fixture = TestBed.createComponent(UiTextField);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input');
    const emptyMessage = element.querySelector('.ui-field__message');

    expect(emptyMessage?.getAttribute('aria-hidden')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBeNull();

    fixture.componentRef.setInput('error', 'Invalid value');
    await fixture.whenStable();

    const errorMessage = element.querySelector('.ui-field__message');
    expect(errorMessage).toBe(emptyMessage);
    expect(errorMessage?.getAttribute('role')).toBe('alert');
    expect(errorMessage?.getAttribute('aria-hidden')).toBeNull();
    expect(errorMessage?.textContent).toContain('Invalid value');
    expect(input?.getAttribute('aria-describedby')).toBe(errorMessage?.id);
  });
});
