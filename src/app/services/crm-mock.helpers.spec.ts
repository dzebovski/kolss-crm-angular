import { CRM_MOCK_EMPLOYEES, CRM_MOCK_LEADS } from './crm-mock.data';
import {
  activeRemindersForLead,
  calculateFunnel,
  calculateManagerTakenReport,
  callStatusTone,
  clientStatusTone,
  commentAssigneeForLead,
  commentDueAtForLead,
  groupLeadsByYearMonth,
  matchesLeadSearch,
  showroomDueAtForLead,
  sumContractsByCurrency,
  validateCloseLead,
  validateSuccessfulLead,
} from './crm-mock.helpers';
import type { ContractCurrency, MockLead } from './crm-mock.types';

describe('CRM status tones', () => {
  it('maps every call result to the shared semantic palette', () => {
    expect([
      callStatusTone('reached'),
      callStatusTone('no_answer'),
      callStatusTone('callback_requested'),
      callStatusTone(null),
    ]).toEqual(['success', 'danger', 'brand', 'neutral']);
  });

  it('maps every client status to the shared semantic palette', () => {
    expect([
      clientStatusTone('new_lead'),
      clientStatusTone('showroom_invited'),
      clientStatusTone('calculation_in_progress'),
      clientStatusTone('thinking'),
      clientStatusTone('closed_lost'),
      clientStatusTone('contract_signed'),
    ]).toEqual(['brand', 'info', 'warning', 'brand', 'danger', 'success']);
  });
});

describe('independent due dates', () => {
  const base = {
    callbackDueAt: '2026-08-03T12:00:00.000Z',
    commentReminderDueAt: '2026-08-06T12:00:00.000Z',
  };

  it('returns showroom and comment dates independently', () => {
    expect(
      showroomDueAtForLead({
        ...base,
        showroomDueAt: '2026-08-05T12:00:00.000Z',
      }),
    ).toBe('2026-08-05T12:00:00.000Z');
    expect(commentDueAtForLead(base)).toBe('2026-08-06T12:00:00.000Z');
  });

  it('does not resurrect a stale comment reminder when the API returns null', () => {
    expect(commentDueAtForLead({ commentReminderDueAt: null })).toBeNull();
  });

  it('returns the active comment task assignee independently', () => {
    expect(commentAssigneeForLead({ commentReminderAssignedTo: 'emp-kyiv-1' })).toBe('emp-kyiv-1');
    expect(commentAssigneeForLead({ commentReminderAssignedTo: null })).toBeNull();
  });

  it('supports the legacy callback context for showroom dates', () => {
    expect(
      showroomDueAtForLead({
        ...base,
        callbackDueContext: { category: 'client_status', statusCode: 'showroom_invited' },
      }),
    ).toBe(base.callbackDueAt);
  });
});

describe('activeRemindersForLead', () => {
  it('lists callback, thinking, showroom, and comment reminders with due dates', () => {
    expect(
      activeRemindersForLead({
        callStatus: 'callback_requested',
        clientStatus: 'thinking',
        callbackDueAt: '2026-07-25T12:00:00.000Z',
        commentReminderDueAt: '2026-07-26T12:00:00.000Z',
        showroomDueAt: '2026-08-05T12:00:00.000Z',
      }),
    ).toEqual([
      { kind: 'callback', dueAt: '2026-07-25T12:00:00.000Z' },
      { kind: 'thinking', dueAt: '2026-07-25T12:00:00.000Z' },
      { kind: 'showroom', dueAt: '2026-08-05T12:00:00.000Z' },
      { kind: 'comment', dueAt: '2026-07-26T12:00:00.000Z' },
    ]);
  });

  it('omits reminders without a due date', () => {
    expect(
      activeRemindersForLead({
        callStatus: 'callback_requested',
        clientStatus: 'thinking',
        callbackDueAt: null,
        commentReminderDueAt: null,
        showroomDueAt: null,
      }),
    ).toEqual([]);
  });
});

describe('crm helpers', () => {
  it('searches and groups leads by year and month', () => {
    const matching = CRM_MOCK_LEADS.filter((lead) => matchesLeadSearch(lead, 'Марина'));
    expect(matching.map((lead) => lead.id)).toEqual(['lead-1001']);

    const groups = groupLeadsByYearMonth(CRM_MOCK_LEADS);
    expect(groups[0].key).toBe('2026-07');
    expect(groups.some((group) => group.key === '2025-12')).toBe(true);
  });

  it('sums contract amounts by currency for a month group', () => {
    const base = CRM_MOCK_LEADS[0]!;
    const withContract = (amount: number, currency: ContractCurrency): MockLead => ({
      ...base,
      contract: {
        contractNumber: 'K-1',
        amount,
        currency,
        comment: '',
        signedAt: '2026-07-01T12:00:00.000Z',
      },
    });

    expect(sumContractsByCurrency([base, { ...base, contract: null }])).toEqual([]);
    expect(sumContractsByCurrency([withContract(1000, 'UAH'), withContract(500, 'UAH')])).toEqual([
      { currency: 'UAH', total: 1500 },
    ]);
    expect(
      sumContractsByCurrency([
        withContract(1000, 'UAH'),
        withContract(200, 'USD'),
        withContract(50, 'EUR'),
        withContract(300, 'UAH'),
      ]),
    ).toEqual([
      { currency: 'UAH', total: 1300 },
      { currency: 'USD', total: 200 },
      { currency: 'EUR', total: 50 },
    ]);

    const juneGroup = groupLeadsByYearMonth(CRM_MOCK_LEADS).find((group) => group.key === '2026-06');
    expect(juneGroup?.contractTotals).toEqual([{ currency: 'EUR', total: 29800 }]);
  });

  it('validates close and successful lead payloads', () => {
    expect(validateCloseLead({ reason: 'lost_client', comment: '' })).toBe('validation.lostClientComment');
    expect(validateCloseLead({ reason: 'expensive', comment: '' })).toBeNull();
    expect(
      validateSuccessfulLead({ contractNumber: '', amount: 1000, currency: 'UAH', comment: '' }),
    ).toBe('validation.contractNumber');
    expect(
      validateSuccessfulLead({
        contractNumber: 'K-1',
        amount: 1000,
        currency: 'UAH',
        comment: '',
      }),
    ).toBeNull();
    expect(
      validateSuccessfulLead({
        contractNumber: 'K-1',
        amount: 1000,
        currency: 'GBP' as ContractCurrency,
        comment: '',
      }),
    ).toBe('validation.contractCurrency');
  });

  it('calculates funnel metrics from leads', () => {
    const funnel = calculateFunnel(CRM_MOCK_LEADS, 40);
    expect(funnel[0]?.count).toBeGreaterThan(0);

    const byKey = new Map(funnel.map((stage) => [stage.key, stage] as const));
    const stage = (key: string) => {
      const value = byKey.get(key);
      expect(value).toBeTruthy();
      return value!;
    };
    const pct = (count: number, base: number) => (base ? Math.round((count / base) * 100) : 0);

    const created = stage('created');
    const taken = stage('taken');
    const scheduled = stage('scheduled');
    const visited = stage('visited');
    const successful = stage('successful');
    const closed = stage('closed');

    expect(created.conversionFromPrevious).toBe(0);
    expect(created.conversionBaseLabel).toBeNull();
    expect(taken.conversionFromPrevious).toBe(pct(taken.count, created.count));
    expect(taken.conversionBaseLabel).toBe('funnel.created');
    expect(scheduled.conversionFromPrevious).toBe(pct(scheduled.count, taken.count));
    expect(scheduled.conversionBaseLabel).toBe('funnel.taken');
    expect(visited.conversionFromPrevious).toBe(pct(visited.count, scheduled.count));
    expect(visited.conversionBaseLabel).toBe('funnel.scheduled');
    expect(successful.conversionFromPrevious).toBe(pct(successful.count, taken.count));
    expect(successful.conversionBaseLabel).toBe('funnel.taken');
    expect(closed.conversionFromPrevious).toBe(pct(closed.count, taken.count));
    expect(closed.conversionBaseLabel).toBe('funnel.taken');
  });

  it('calculates manager taken report per office', () => {
    const kyiv = calculateManagerTakenReport(CRM_MOCK_LEADS, CRM_MOCK_EMPLOYEES, 'kyiv', 40);
    const warsaw = calculateManagerTakenReport(CRM_MOCK_LEADS, CRM_MOCK_EMPLOYEES, 'warsaw', 40);

    expect(kyiv.officeLabel).toBe('Київ');
    expect(warsaw.officeLabel).toBe('Варшава');
    expect(kyiv.managers.length).toBeGreaterThan(0);
    expect(warsaw.managers.length).toBeGreaterThan(0);

    const kyivMoroz = kyiv.managers.find((row) => row.managerId === 'emp-kyiv-1');
    const kyivLytvyn = kyiv.managers.find((row) => row.managerId === 'emp-kyiv-2');
    const kyivPavlenko = kyiv.managers.find((row) => row.managerId === 'emp-kyiv-3');

    expect(kyivMoroz?.takenCount).toBe(2);
    expect(kyivLytvyn?.takenCount).toBe(1);
    expect(kyivPavlenko?.takenCount).toBe(0);
    expect(kyiv.managers[0]?.takenCount).toBeGreaterThanOrEqual(kyiv.managers.at(-1)?.takenCount ?? 0);

    const warsawNowak = warsaw.managers.find((row) => row.managerId === 'emp-warsaw-1');
    expect(warsawNowak?.takenCount).toBe(2);
    expect(warsaw.unassignedCount).toBeGreaterThanOrEqual(0);
  });

  it('attributes taken counts to current assignedToId over firstManagerId', () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1003')!;
    const reassigned = {
      ...lead,
      assignedToId: 'emp-kyiv-2',
      firstManagerId: 'emp-kyiv-1',
    };
    const report = calculateManagerTakenReport([reassigned], CRM_MOCK_EMPLOYEES, 'kyiv', 40);
    const kyivMoroz = report.managers.find((row) => row.managerId === 'emp-kyiv-1');
    const kyivLytvyn = report.managers.find((row) => row.managerId === 'emp-kyiv-2');

    expect(kyivMoroz?.takenCount).toBe(0);
    expect(kyivLytvyn?.takenCount).toBe(1);
  });
});
