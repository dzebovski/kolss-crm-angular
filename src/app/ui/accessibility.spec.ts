import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { UiAlert } from './feedback/ui-alert';
import { UiTextField } from './form/ui-text-field';

describe('KOLSS UI accessibility', () => {
  it('has no automated accessibility violations in a form control', async () => {
    const fixture = TestBed.createComponent(UiTextField);
    fixture.componentRef.setInput('label', 'Company name');
    fixture.componentRef.setInput('hint', 'Use the registered business name.');
    await fixture.whenStable();

    const results = await axe.run(fixture.nativeElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it('has no automated accessibility violations in feedback', async () => {
    const fixture = TestBed.createComponent(UiAlert);
    fixture.componentRef.setInput('title', 'Import complete');
    await fixture.whenStable();

    const results = await axe.run(fixture.nativeElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
