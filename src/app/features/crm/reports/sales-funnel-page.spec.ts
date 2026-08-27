import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { vi } from 'vitest';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  SalesFunnelReportQuery,
  SalesFunnelReportResponse,
} from '@core/api/generated/kolss-api.types';
import { SessionService } from '@core/session/session.service';
import { SalesFunnelPage } from './sales-funnel-page';

const report: SalesFunnelReportResponse = {
  generatedAt: '2026-08-27T10:00:00Z',
  period: { from: '2026-08-21', to: '2026-08-27' },
  stages: {
    leads: { count: 100, percent: 100 },
    calls: { count: 90, percent: 90 },
    reached: { count: 72, percent: 80 },
    notReached: { count: 18, percent: 20 },
    showroomInvited: { count: 40, percent: 56 },
    showroomVisited: { count: 25, percent: 63 },
    measurementScheduled: { count: 30, percent: 42 },
    measurementCompleted: { count: 18, percent: 60 },
    calculationStarted: { count: 36, percent: 50 },
  },
  potential: { currency: 'EUR', total: 250_000 },
  contractTotals: [
    { currency: 'UAH', total: 1_200_000 },
    { currency: 'EUR', total: 75_000 },
  ],
};

describe('SalesFunnelPage', () => {
  const salesFunnelReport = vi.fn(
    async (query: SalesFunnelReportQuery): Promise<SalesFunnelReportResponse> => {
      void query;
      return report;
    },
  );
  const selectedOfficeId = signal<string | null>(null);

  beforeEach(async () => {
    salesFunnelReport.mockReset();
    salesFunnelReport.mockResolvedValue(report);
    selectedOfficeId.set(null);
    await TestBed.configureTestingModule({
      imports: [SalesFunnelPage],
      providers: [
        provideRouter([]),
        {
          provide: KolssApiClient,
          useValue: { salesFunnelReport },
        },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            selectedOfficeId,
          },
        },
      ],
    }).compileComponents();
  });

  it('loads a seven-day cohort and renders funnel and money totals', async () => {
    const fixture = TestBed.createComponent(SalesFunnelPage);
    await fixture.whenStable();

    expect(salesFunnelReport).toHaveBeenCalledTimes(1);
    const query = salesFunnelReport.mock.calls[0][0];
    expect(query.officeId).toBeNull();
    expect(calendarDaySpan(query.from, query.to)).toBe(7);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Воронка продажів');
    expect(element.textContent).toContain('Надійшло лідів');
    expect(element.textContent).toContain('100');
    expect(element.textContent).toContain('80% від дзвінків');
    expect(element.textContent).toContain('250 000');
    expect(element.textContent).toContain('1 200 000');
    expect(element.querySelectorAll('.funnel-branch')).toHaveLength(3);
  });

  it('applies the 30-day preset immediately', async () => {
    const fixture = TestBed.createComponent(SalesFunnelPage);
    await fixture.whenStable();

    buttonWithText(fixture.nativeElement, 'Останні 30 днів').click();
    await fixture.whenStable();

    const query = salesFunnelReport.mock.calls.at(-1)?.[0];
    expect(query).toBeDefined();
    expect(calendarDaySpan(query!.from, query!.to)).toBe(30);
  });

  it('applies a valid custom range and reloads when the office changes', async () => {
    const fixture = TestBed.createComponent(SalesFunnelPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    buttonWithText(element, 'Власні дати').click();
    await fixture.whenStable();
    const inputs = element.querySelectorAll<HTMLInputElement>('.custom-period input');
    setInputValue(inputs[0], '2026-06-01');
    setInputValue(inputs[1], '2026-06-30');
    element
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(salesFunnelReport).toHaveBeenLastCalledWith({
      officeId: null,
      from: '2026-06-01',
      to: '2026-06-30',
    });

    selectedOfficeId.set('office-kyiv');
    await fixture.whenStable();
    expect(salesFunnelReport).toHaveBeenLastCalledWith({
      officeId: 'office-kyiv',
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });

  it('renders an empty cohort state', async () => {
    salesFunnelReport.mockResolvedValueOnce({
      ...report,
      stages: Object.fromEntries(
        Object.keys(report.stages).map((key) => [key, { count: 0, percent: 0 }]),
      ) as unknown as SalesFunnelReportResponse['stages'],
      potential: { currency: 'EUR', total: 0 },
      contractTotals: [],
    });
    const fixture = TestBed.createComponent(SalesFunnelPage);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'У цьому періоді немає лідів',
    );
  });

  it('renders API errors', async () => {
    salesFunnelReport.mockRejectedValueOnce(new Error('report failed'));
    const fixture = TestBed.createComponent(SalesFunnelPage);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('report failed');
  });

  it('passes an automated accessibility scan', async () => {
    const fixture = TestBed.createComponent(SalesFunnelPage);
    await fixture.whenStable();

    const result = await axe.run(fixture.nativeElement as HTMLElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});

function calendarDaySpan(from: string, to: string): number {
  const milliseconds = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return milliseconds / 86_400_000 + 1;
}

function buttonWithText(root: ParentNode, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
    item.textContent?.includes(text),
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}
