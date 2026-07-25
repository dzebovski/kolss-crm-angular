import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import {
  activeRemindersForLead,
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
} from './lead.rules';
import type { ContractCurrency, Lead } from './lead.types';

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
    const matching = FIXTURE_LEADS.filter((lead) => matchesLeadSearch(lead, 'Марина'));
    expect(matching.map((lead) => lead.id)).toEqual(['lead-1001']);

    const groups = groupLeadsByYearMonth(FIXTURE_LEADS);
    expect(groups[0].key).toBe('2026-07');
    expect(groups.some((group) => group.key === '2025-12')).toBe(true);
  });

  it('sums contract amounts by currency for a month group', () => {
    const base = FIXTURE_LEADS[0]!;
    const withContract = (amount: number, currency: ContractCurrency): Lead => ({
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

    const juneGroup = groupLeadsByYearMonth(FIXTURE_LEADS).find((group) => group.key === '2026-06');
    expect(juneGroup?.contractTotals).toEqual([{ currency: 'EUR', total: 29800 }]);
  });

  it('validates close and successful lead payloads', () => {
    expect(validateCloseLead({ reason: 'lost_client', comment: '' })).toBe(
      'validation.lostClientComment',
    );
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
});
