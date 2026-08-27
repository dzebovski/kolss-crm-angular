import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import axe from 'axe-core';
import { vi } from 'vitest';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { SessionService } from '@core/session/session.service';
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
    overdueNextActionCount: 1,
    conversionPercent: 33,
    byClientStatus: {
      new_lead: 0,
      showroom_invited: 0,
      measurement_scheduled: 0,
      calculation_in_progress: 1,
      thinking: 0,
      postponed: 0,
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
        overdueNextActionCount: 1,
        conversionPercent: 0,
        byClientStatus: {
          new_lead: 0,
          showroom_invited: 0,
          measurement_scheduled: 0,
          calculation_in_progress: 1,
          thinking: 0,
          postponed: 0,
          closed_lost: 1,
          contract_signed: 0,
        },
      },
      leads: [
        {
          id: 'lead-calculation',
          referenceId: 'k0001',
          name: 'ТОВ Приклад',
          phone: '+380 67 123 45 67',
          createdAt: '2026-06-01T09:00:00Z',
          clientStatus: 'calculation_in_progress',
          clientStatusChangedAt: '2026-06-10T09:00:00Z',
          callStatus: 'callback_requested',
          callStatusChangedAt: '2026-07-01T09:00:00Z',
          lossReason: null,
          nextActionAt: '2026-07-11T12:00:00Z',
          overdueDays: 6,
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
          referenceId: 'k0002',
          name: 'Іван Петренко',
          phone: '+380 50 000 00 00',
          createdAt: '2026-06-03T09:00:00Z',
          clientStatus: 'closed_lost',
          clientStatusChangedAt: '2026-07-12T09:00:00Z',
          callStatus: 'reached',
          callStatusChangedAt: '2026-07-12T09:00:00Z',
          lossReason: 'expensive',
          nextActionAt: '2026-07-20T12:00:00Z',
          overdueDays: 0,
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
        overdueNextActionCount: 0,
        conversionPercent: 100,
        byClientStatus: {
          new_lead: 0,
          showroom_invited: 0,
          measurement_scheduled: 0,
          calculation_in_progress: 0,
          thinking: 0,
          postponed: 0,
          closed_lost: 0,
          contract_signed: 1,
        },
      },
      leads: [
        {
          id: 'lead-sold',
          referenceId: 'w0001',
          name: 'Anna Nowak',
          phone: '+48 500 000 000',
          createdAt: '2026-06-04T09:00:00Z',
          clientStatus: 'contract_signed',
          clientStatusChangedAt: '2026-07-15T09:00:00Z',
          callStatus: 'reached',
          callStatusChangedAt: '2026-07-15T09:00:00Z',
          lossReason: null,
          nextActionAt: null,
          overdueDays: 0,
          comments: [],
        },
      ],
    },
  ],
};

describe('ReportsPage', () => {
  const reportApi = vi.fn(async () => report);
  const selectedOfficeId = signal<string | null>(null);

  beforeEach(async () => {
    reportApi.mockReset();
    reportApi.mockResolvedValue(report);
    selectedOfficeId.set(null);
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
            selectedOfficeId,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the compact summary and a flat six-column lead table', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Підсумок роботи з лідами');
    expect(element.textContent).toContain('Прострочені наступні дії');
    expect(element.querySelectorAll('app-lead-report-table')).toHaveLength(1);
    expect(element.textContent).not.toContain('Детальний звіт менеджера');

    const leadTable = element.querySelector<HTMLTableElement>(
      'app-lead-report-table .lead-report-table',
    );
    expect(leadTable).not.toBeNull();
    expect(leadTable!.querySelectorAll('thead th')).toHaveLength(6);
    expect(
      [...leadTable!.querySelectorAll('thead th')].map((header) => header.textContent?.trim()),
    ).toEqual([
      'Дата',
      'Контакт',
      'Результат дзвінка',
      'Статус клієнта',
      'Останній коментар',
      'Попередній коментар',
    ]);
    expect(leadTable!.querySelector('.status-group__heading')).toBeNull();
    expect(leadTable!.querySelectorAll('tr.report-lead-block')).toHaveLength(3);

    const leadNames = [...leadTable!.querySelectorAll<HTMLElement>('tr.report-lead-block')].map(
      (row) => row.querySelector('.lead-identity strong')?.textContent?.trim(),
    );
    expect(leadNames).toEqual(['Anna Nowak', 'Іван Петренко', 'ТОВ Приклад']);
    const leadReferences = [
      ...leadTable!.querySelectorAll<HTMLElement>('.lead-identity app-lead-reference'),
    ].map((reference) => reference.textContent?.trim());
    expect(leadReferences).toEqual(['w0001', 'k0002', 'k0001']);

    const summarySold = element.querySelector('.summary-ledger .is-sold');
    expect(summarySold?.querySelector('.sold-metric > strong')?.textContent?.trim()).toBe('1');
    expect(
      summarySold?.querySelector('.sold-amounts')?.textContent?.replace(/\s+/g, ' ').trim(),
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
    const overdueAction = calculationRow!.querySelector('.lead-client-status .is-stale');
    expect(overdueAction?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Наступна дія 11.07.2026 · прострочено на 6 дн.',
    );
    expect(overdueAction?.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-07-11T12:00:00Z',
    );
    expect(calculationRow!.textContent).not.toContain('без активності');

    const lostRow = [...element.querySelectorAll<HTMLElement>('tr.report-lead-block')].find((row) =>
      row.textContent?.includes('Іван Петренко'),
    );
    expect(lostRow?.querySelector('.lead-client-status')?.textContent).toContain('Дорого');
    expect(lostRow?.querySelector('.lead-client-status .is-stale')).toBeNull();
    expect(lostRow?.querySelectorAll('.lead-comment .empty-value')).toHaveLength(2);
  });

  it('loads all time by default and applies month and custom periods', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(reportApi).toHaveBeenCalledWith({
      officeId: null,
      cohort: 'activity',
      from: null,
      to: null,
      callStatus: null,
      clientStatus: null,
    });

    buttonByText(element, 'Календарний місяць').click();
    await fixture.whenStable();
    const month = element.querySelector<HTMLInputElement>('input[type="month"]');
    expect(month).not.toBeNull();
    setInputValue(month!, '2026-06');
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenLastCalledWith({
      officeId: null,
      cohort: 'activity',
      from: '2026-06-01',
      to: '2026-06-30',
      callStatus: null,
      clientStatus: null,
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
      cohort: 'activity',
      from: '2026-05-10',
      to: '2026-05-31',
      callStatus: null,
      clientStatus: null,
    });
  });

  it('keeps calendar drafts separate and supports month and custom calendar ranges', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    buttonByText(element, 'За календарем').click();
    await fixture.whenStable();
    expect(element.querySelector('.criteria-section--period')?.textContent).not.toContain(
      'За весь час',
    );

    const calendarMonth = element.querySelector<HTMLInputElement>('input[type="month"]');
    expect(calendarMonth).not.toBeNull();
    setInputValue(calendarMonth!, '2026-07');
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenLastCalledWith({
      officeId: null,
      cohort: 'calendar',
      from: '2026-07-01',
      to: '2026-07-31',
      callStatus: null,
      clientStatus: null,
    });

    buttonByText(element, 'Власні дати').click();
    await fixture.whenStable();
    const dates = element.querySelectorAll<HTMLInputElement>('input[type="date"]');
    setInputValue(dates[0]!, '2026-08-03');
    setInputValue(dates[1]!, '2026-08-09');
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenLastCalledWith({
      officeId: null,
      cohort: 'calendar',
      from: '2026-08-03',
      to: '2026-08-09',
      callStatus: null,
      clientStatus: null,
    });

    buttonByText(element, 'За активністю').click();
    await fixture.whenStable();
    expect(element.textContent).toContain('За весь час');
    buttonByText(element, 'Календарний місяць').click();
    await fixture.whenStable();
    expect(element.querySelector<HTMLInputElement>('input[type="month"]')?.value).not.toBe(
      '2026-07',
    );
  });

  it('validates only the active custom range and applies draft changes atomically', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const initialCalls = reportApi.mock.calls.length;

    buttonByText(element, 'За календарем').click();
    await fixture.whenStable();
    buttonByText(element, 'Власні дати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenCalledTimes(initialCalls);

    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Вкажіть обидві дати періоду.');
    expect(reportApi).toHaveBeenCalledTimes(initialCalls);

    const dates = element.querySelectorAll<HTMLInputElement>('input[type="date"]');
    setInputValue(dates[0]!, '2026-08-20');
    setInputValue(dates[1]!, '2026-08-10');
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Дата «від» не може бути пізнішою');
    expect(reportApi).toHaveBeenCalledTimes(initialCalls);

    setInputValue(dates[1]!, '2026-08-31');
    expect(reportApi).toHaveBeenCalledTimes(initialCalls);
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenCalledTimes(initialCalls + 1);
  });

  it('uses the complete shared status taxonomy and keeps active mutually exclusive', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const page = pageHarness(fixture.componentInstance);

    expect(page.callStatusOptions().map((option) => option.value)).toEqual([
      'reached',
      'no_answer',
      'callback_requested',
      'none',
      'callback_undated',
    ]);
    expect(page.clientStatusOptions().map((option) => option.value)).toEqual([
      'new_lead',
      'in_work',
      'showroom_invited',
      'measurement_scheduled',
      'calculation_in_progress',
      'thinking',
      'postponed',
      'closed_lost',
      'contract_signed',
    ]);

    page.criteriaModel.update((value) => ({
      ...value,
      callStatuses: ['no_answer', 'callback_undated'],
      clientStatuses: ['thinking', 'closed_lost'],
    }));
    await fixture.whenStable();
    buttonByText(fixture.nativeElement as HTMLElement, 'Сформувати').click();
    await fixture.whenStable();
    expect(reportApi).toHaveBeenLastCalledWith(
      expect.objectContaining({
        callStatus: 'no_answer,callback_undated',
        clientStatus: 'thinking,closed_lost',
      }),
    );

    page.criteriaModel.update((value) => ({ ...value, activeClientsOnly: true }));
    await fixture.whenStable();
    expect(page.criteriaModel().clientStatuses).toEqual([]);
    expect(page.criteriaModel().activeClientsOnly).toBe(true);

    page.criteriaModel.update((value) => ({ ...value, clientStatuses: ['postponed'] }));
    await fixture.whenStable();
    expect(page.criteriaModel().activeClientsOnly).toBe(false);
    expect(page.criteriaModel().clientStatuses).toEqual(['postponed']);
  });

  it('shows the applied mode, period, and statuses in the screen and print summary', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const page = pageHarness(fixture.componentInstance);
    const element = fixture.nativeElement as HTMLElement;

    page.criteriaModel.update((value) => ({
      ...value,
      cohort: 'calendar',
      calendarMonth: '2026-07',
      callStatuses: ['none'],
      activeClientsOnly: true,
    }));
    await fixture.whenStable();
    buttonByText(element, 'Сформувати').click();
    await fixture.whenStable();

    const summary = element.querySelector('.criteria-summary');
    expect(summary?.textContent).toContain('За календарем');
    expect(summary?.textContent).toContain('01.07.2026 — 31.07.2026');
    expect(summary?.textContent).toContain('Не телефонували');
    expect(summary?.textContent).toContain('Активні');
  });

  it('reloads the already applied criteria when the office changes', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    const page = pageHarness(fixture.componentInstance);

    page.criteriaModel.update((value) => ({
      ...value,
      cohort: 'calendar',
      calendarPeriodMode: 'custom',
      calendarFrom: '2026-06-10',
      calendarTo: '2026-06-12',
      callStatuses: ['reached'],
    }));
    await fixture.whenStable();
    buttonByText(fixture.nativeElement as HTMLElement, 'Сформувати').click();
    await fixture.whenStable();

    selectedOfficeId.set('office-warsaw');
    await fixture.whenStable();
    expect(reportApi).toHaveBeenLastCalledWith({
      officeId: 'office-warsaw',
      cohort: 'calendar',
      from: '2026-06-10',
      to: '2026-06-12',
      callStatus: 'reached',
      clientStatus: null,
    });
  });

  it('renders loading, empty, and error states', async () => {
    let resolveReport: ((value: LeadReportResponse) => void) | undefined;
    reportApi.mockImplementationOnce(
      () =>
        new Promise<LeadReportResponse>((resolve) => {
          resolveReport = resolve;
        }),
    );
    const loadingFixture = TestBed.createComponent(ReportsPage);
    loadingFixture.detectChanges();
    expect(
      (loadingFixture.nativeElement as HTMLElement).querySelector('.report-loading'),
    ).not.toBeNull();
    resolveReport?.(report);
    await loadingFixture.whenStable();

    reportApi.mockResolvedValueOnce({
      ...report,
      totals: { ...report.totals, total: 0 },
      managers: [],
    });
    const emptyFixture = TestBed.createComponent(ReportsPage);
    await emptyFixture.whenStable();
    expect((emptyFixture.nativeElement as HTMLElement).textContent).toContain(
      'Немає лідів для звіту',
    );

    reportApi.mockRejectedValueOnce(new Error('report failed'));
    const errorFixture = TestBed.createComponent(ReportsPage);
    await errorFixture.whenStable();
    expect((errorFixture.nativeElement as HTMLElement).textContent).toContain('report failed');
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

interface CriteriaDraft {
  readonly cohort: 'activity' | 'calendar';
  readonly activityPeriodMode: 'all' | 'month' | 'custom';
  readonly activityMonth: string;
  readonly activityFrom: string;
  readonly activityTo: string;
  readonly calendarPeriodMode: 'month' | 'custom';
  readonly calendarMonth: string;
  readonly calendarFrom: string;
  readonly calendarTo: string;
  readonly callStatuses: readonly (
    'reached' | 'no_answer' | 'callback_requested' | 'none' | 'callback_undated'
  )[];
  readonly clientStatuses: readonly (
    | 'new_lead'
    | 'in_work'
    | 'showroom_invited'
    | 'measurement_scheduled'
    | 'calculation_in_progress'
    | 'thinking'
    | 'postponed'
    | 'closed_lost'
    | 'contract_signed'
  )[];
  readonly activeClientsOnly: boolean;
}

interface ReportsPageHarness {
  readonly criteriaModel: WritableSignal<CriteriaDraft>;
  readonly callStatusOptions: () => readonly { readonly value: string }[];
  readonly clientStatusOptions: () => readonly { readonly value: string }[];
}

function pageHarness(component: ReportsPage): ReportsPageHarness {
  return component as unknown as ReportsPageHarness;
}
