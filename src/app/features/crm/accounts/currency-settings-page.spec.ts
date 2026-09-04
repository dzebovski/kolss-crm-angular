import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { setActiveLocale } from '@core/i18n/locale-storage';
import { CurrencyRatesService } from '@services/currency-rates.service';
import { CurrencySettingsPage } from './currency-settings-page';

describe('CurrencySettingsPage', () => {
  const current = {
    version: 3,
    effectiveFrom: '2026-09-03T12:00:00Z',
    plnPerEur: 4.2,
    uahPerEur: 52,
    uahPerUsd: 44.2,
  };
  const load = vi.fn(async () => current);
  const update = vi.fn(async () => ({ ...current, version: 4 }));

  beforeEach(async () => {
    setActiveLocale('uk');
    load.mockReset();
    load.mockResolvedValue(current);
    update.mockReset();
    update.mockResolvedValue({ ...current, version: 4 });
    await TestBed.configureTestingModule({
      imports: [CurrencySettingsPage],
      providers: [provideRouter([]), { provide: CurrencyRatesService, useValue: { load, update } }],
    }).compileComponents();
  });

  it('renders current rates and saves a complete new version', async () => {
    const fixture = TestBed.createComponent(CurrencySettingsPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Currency exchange rates');
    expect(inputByLabel(element, '1 EUR equals PLN')?.value).toBe('4.2');
    fixture.componentInstance['model'].set({
      plnPerEur: '4,3',
      uahPerEur: '53',
      uahPerUsd: '45',
    });

    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(update).toHaveBeenCalledWith(3, {
      plnPerEur: 4.3,
      uahPerEur: 53,
      uahPerUsd: 45,
    });
    expect(element.textContent).toContain('A new currency-rate version was saved.');
  });

  it('reloads after an optimistic concurrency conflict', async () => {
    update.mockRejectedValueOnce(new KolssApiError('stale', 'version_conflict', 409));
    const fixture = TestBed.createComponent(CurrencySettingsPage);
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(load).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Another administrator changed the rates.',
    );
  });

  it('rejects non-positive values without saving', async () => {
    const fixture = TestBed.createComponent(CurrencySettingsPage);
    await fixture.whenStable();
    fixture.componentInstance['model'].update((value) => ({ ...value, plnPerEur: '0' }));

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(update).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Enter a number greater than zero.',
    );
  });

  it('passes an automated accessibility scan', async () => {
    const fixture = TestBed.createComponent(CurrencySettingsPage);
    await fixture.whenStable();

    const result = await axe.run(fixture.nativeElement as HTMLElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});

function inputByLabel(root: HTMLElement, labelText: string): HTMLInputElement | null {
  const label = [...root.querySelectorAll('label')].find((item) =>
    item.textContent?.includes(labelText),
  );
  return label ? root.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
}
