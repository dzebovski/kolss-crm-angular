import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { vi } from 'vitest';

import { KolssApiClient } from '../../../core/api/generated/kolss-api.client';
import { SessionService } from '../../../core/session/session.service';
import type { LeadReportResponse } from './reports.types';
import { ReportsPage } from './reports-page';

const report: LeadReportResponse = {
  generatedAt: '2026-07-17T10:00:00Z',
  period: { from: null, to: null },
  totals: {
    total: 3,
    active: 1,
    contractSigned: 1,
    contractTotals: [{ currency: 'PLN', total: 29800 }],
    closedLost: 1,
    callback: 1,
    inactive7d: 1,
    conversionPercent: 33,
    byClientStatus: {
      new_lead: 0,
      showroom_invited: 0,
      calculation_in_progress: 1,
      thinking: 0,
      closed_lost: 1,
      contract_signed: 1,
    },
  },
  lossReasons: [
    {
      code: 'expensive',
      labelUk: 'Дорого',
      labelPl: 'Za drogo',
      labelEn: 'Too expensive',
      count: 1,
      percent: 100,
    },
  ],
  managers: [
    {
      officeCode: 'kyiv',
      managerId: 'manager-1',
      managerName: 'Олена Коваль',
      totals: {
        total: 2,
        active: 1,
        contractSigned: 0,
        contractTotals: [],
        closedLost: 1,
        callback: 1,
        inactive7d: 1,
        conversionPercent: 0,
        byClientStatus: {
          new_lead: 0,
          showroom_invited: 0,
          calculation_in_progress: 1,
          thinking: 0,
          closed_lost: 1,
          contract_signed: 0,
        },
      },
      leads: [
        {
          id: 'lead-calculation',
          name: 'ТОВ Приклад',
          phone: '+380 67 123 45 67',
          createdAt: '2026-06-01T09:00:00Z',
          clientStatus: 'calculation_in_progress',
          clientStatusChangedAt: '2026-06-10T09:00:00Z',
          callStatus: 'callback_requested',
          callStatusChangedAt: '2026-07-01T09:00:00Z',
          lossReason: null,
          lastHumanActivityAt: '2026-07-08T09:00:00Z',
          inactiveDays: 9,
          inactive7d: true,
          comments: [
            {
              body: 'Клієнт чекає фінальну версію прорахунку без скорочення тексту.',
              occurredAt: '2026-07-08T09:00:00Z',
              authorId: 'manager-1',
              authorName: 'Олена Коваль',
              eventType: 'comment_added',
            },
            {
              body: 'Погодили матеріали та остаточні розміри.',
              occurredAt: '2026-07-06T09:00:00Z',
              authorId: 'manager-1',
              authorName: 'Олена Коваль',
              eventType: 'call_status_changed',
            },
          ],
        },
        {
          id: 'lead-lost',
          name: 'Іван Петренко',
          phone: '+380 50 000 00 00',
          createdAt: '2026-06-03T09:00:00Z',
          clientStatus: 'closed_lost',
          clientStatusChangedAt: '2026-07-12T09:00:00Z',
          callStatus: 'reached',
          callStatusChangedAt: '2026-07-12T09:00:00Z',
          lossReason: 'expensive',
          lastHumanActivityAt: '2026-07-12T09:00:00Z',
          inactiveDays: 5,
          inactive7d: false,
          comments: [],
        },
      ],
    },
    {
      officeCode: 'warsaw',
      managerId: null,
      managerName: '',
      totals: {
        total: 1,
        active: 0,
        contractSigned: 1,
        contractTotals: [{ currency: 'PLN', total: 29800 }],
        closedLost: 0,
        callback: 0,
        inactive7d: 0,
        conversionPercent: 100,
        byClientStatus: {
          new_lead: 0,
          showroom_invited: 0,
          calculation_in_progress: 0,
          thinking: 0,
          closed_lost: 0,
          contract_signed: 1,
        },
      },
      leads: [
        {
          id: 'lead-sold',
          name: 'Anna Nowak',
          phone: '+48 500 000 000',
          createdAt: '2026-06-04T09:00:00Z',
          clientStatus: 'contract_signed',
          clientStatusChangedAt: '2026-07-15T09:00:00Z',
          callStatus: 'reached',
          callStatusChangedAt: '2026-07-15T09:00:00Z',
          lossReason: null,
          lastHumanActivityAt: '2026-07-15T09:00:00Z',
          inactiveDays: 2,
          inactive7d: false,
          comments: [],
        },
      ],
    },
  ],
};

describe('ReportsPage', () => {
  const reportApi = vi.fn(async () => report);

  beforeEach(async () => {
    reportApi.mockClear();
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        {
          provide: KolssApiClient,
          useValue: { report: reportApi },
        },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            selectedOfficeId: () => null,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the compact summary and six-column manager tables', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Підсумок роботи з лідами');
    expect(element.textContent).toContain('Олена Коваль');
    expect(element.textContent).toContain('Без менеджера');
    expect(element.querySelectorAll('app-manager-report-section')).toHaveLength(2);

    const firstManagerTable = element.querySelector<HTMLTableElement>(
      'app-manager-report-section .lead-report-table',
    );
    expect(firstManagerTable).not.toBeNull();
    expect(firstManagerTable!.querySelectorAll('thead th')).toHaveLength(6);
    expect(
      [...firstManagerTable!.querySelectorAll('thead th')].map((header) =>
        header.textContent?.trim(),
      ),
    ).toEqual([
      'Дата',
      'Контакт',
      'Результат дзвінка',
      'Статус клієнта',
      'Останній коментар',
      'Попередній коментар',
    ]);

    const statusHeadings = [...firstManagerTable!.querySelectorAll('.status-group__heading')].map(
      (row) => row.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(statusHeadings[0]).toContain('Прорахунок');
    expect(statusHeadings[1]).toContain('Втрачено / закрито');

    const summarySold = element.querySelector('.summary-ledger .is-sold');
    expect(summarySold?.querySelector('.sold-metric > strong')?.textContent?.trim()).toBe('1');
    expect(
      summarySold?.querySelector('.sold-amounts')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('29 800 PLN');

    const soldManager = [
      ...element.querySelectorAll<HTMLElement>('app-manager-report-section'),
    ].find((section) => section.textContent?.includes('Anna Nowak'));
    const managerSoldMetric = soldManager?.querySelector('.is-sold');
    expect(managerSoldMetric?.querySelector('.sold-metric > strong')?.textContent?.trim()).toBe(
      '1',
    );
    expect(
      managerSoldMetric?.querySelector('.sold-amounts')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('29 800 PLN');
  });

  it('places full comments newest-first and shows status details and empty placeholders', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const calculationRow = [...element.querySelectorAll<HTMLElement>('tr.report-lead-block')].find(
      (row) => row.textContent?.includes('ТОВ Приклад'),
    );
    expect(calculationRow).toBeDefined();

    const comments = calculationRow!.querySelectorAll<HTMLElement>('.lead-comment');
    expect(comments).toHaveLength(2);
    expect(comments[0]!.textContent).toContain(
      'Клієнт чекає фінальну версію прорахунку без скорочення тексту.',
    );
    expect(comments[1]!.textContent).toContain('Погодили матеріали та остаточні розміри.');
    expect(calculationRow!.querySelector('.lead-client-status')?.textContent).toContain(
      '9 днів без активності',
    );

    const lostRow = [...element.querySelectorAll<HTMLElement>('tr.report-lead-block')].find((row) =>
      row.textContent?.includes('Іван Петренко'),
    );
    expect(lostRow?.querySelector('.lead-client-status')?.textContent).toContain('Дорого');
    expect(lostRow?.querySelectorAll('.lead-comment .empty-value')).toHaveLength(2);
  });

  it('loads all time by default and applies month and custom periods', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(reportApi).toHaveBeenCalledWith({ officeId: null, from: null, to: null });

    buttonByText(element, 'Календарний місяць').click();
    await fixture.whenStable();
    const month = element.querySelector<HTMLInputElement>('input[type="month"]');
    expect(month).not.toBeNull();
    setInputValue(month!, '2026-06');
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenLastCalledWith({
      officeId: null,
      from: '2026-06-01',
      to: '2026-06-30',
    });

    buttonByText(element, 'Власні дати').click();
    await fixture.whenStable();
    const dateInputs = element.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
    setInputValue(dateInputs[0]!, '2026-05-10');
    setInputValue(dateInputs[1]!, '2026-05-31');
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenLastCalledWith({
      officeId: null,
      from: '2026-05-10',
      to: '2026-05-31',
    });
  });

  it('opens the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();

    buttonByText(fixture.nativeElement as HTMLElement, 'Друкувати').click();
    await fixture.whenStable();
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it('has no detectable accessibility violations', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();

    const results = await axe.run(fixture.nativeElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});

function buttonByText(element: HTMLElement, text: string): HTMLButtonElement {
  const button = [...element.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(text),
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
