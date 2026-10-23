import type {
  Project,
  ProjectContract,
  ProjectListItem,
} from '@core/api/generated/kolss-api.types';
import { formatV2Money, v2PercentOf } from './project-money';
import {
  toV2Project,
  toV2ProjectBoard,
  toV2ProjectFacets,
  toV2ProjectListItem,
} from './project.mapper';

const introContract: ProjectContract = {
  id: 'ci',
  kind: 'intro',
  number: 'KW/2026/041-I',
  signedOn: '2026-09-20',
  totalAmount: 500,
  currency: 'PLN',
  paidAmount: 500,
  creditedAmount: 0,
  remainingAmount: 0,
  target50Amount: null,
  file: null,
};

const mainContract: ProjectContract = {
  id: 'cm',
  kind: 'main',
  number: 'KW/2026/041',
  signedOn: '2026-09-25',
  totalAmount: 80000,
  currency: 'PLN',
  paidAmount: 39500,
  creditedAmount: 500,
  remainingAmount: 40000,
  target50Amount: 40000,
  file: { id: 'f1', fileName: 'contract.pdf', sizeBytes: 1024 },
};

const project = (patch: Partial<Project> = {}): Project => ({
  id: 'p1',
  leadId: 'l1',
  clientId: 'cl1',
  officeId: 'o1',
  code: 'W0231',
  status: 'prepayment',
  projectType: 'measure',
  eventDate: '2026-10-05',
  eventTime: null,
  statusDetails: {},
  manager: { id: 'm1', name: 'Kasia Nowak' },
  designer: null,
  client: { name: 'Marta Zielińska', phone: '+48 601 334 812', email: null, cityRegion: null },
  createdAt: '2026-09-24T10:00:00Z',
  createdByName: 'Kasia Nowak',
  statusChangedAt: '2026-09-25T10:00:00Z',
  lastActivityAt: '2026-09-25T10:00:00Z',
  cancellation: null,
  estimate: {
    lines: {
      kitchen: { amount: 60000, currency: 'PLN', note: 'Oak' },
      appliances: null,
      installation: { amount: 3000, currency: 'EUR', note: null },
      countertop: null,
    },
    totals: [
      { amount: 60000, currency: 'PLN' },
      { amount: 3000, currency: 'EUR' },
    ],
    locked: true,
  },
  introDefault: { amount: 500, currency: 'PLN' },
  contracts: { intro: introContract, main: mainContract },
  contract: mainContract,
  payments: [
    {
      id: 'pay0',
      contractId: 'ci',
      contractKind: 'intro',
      amount: 500,
      paidOn: '2026-09-20',
      note: null,
      createdAt: '2026-09-20T16:10:00Z',
      createdByName: 'Kasia Nowak',
      file: null,
    },
    {
      id: 'pay1',
      contractId: 'cm',
      contractKind: 'main',
      amount: 39500,
      paidOn: '2026-09-25',
      note: 'Prepayment',
      createdAt: '2026-09-25T16:10:00Z',
      createdByName: 'Kasia Nowak',
      file: null,
    },
  ],
  permissions: { canEdit: true },
  ...patch,
});

describe('toV2Project', () => {
  it('counts the credited intro amount towards the main contract and its 50% target', () => {
    const main = toV2Project(project()).contracts.main;
    expect(main).toMatchObject({
      kind: 'main',
      total: { amount: 80000, currency: 'PLN' },
      paid: { amount: 39500, currency: 'PLN' },
      credited: { amount: 500, currency: 'PLN' },
      remaining: { amount: 40000, currency: 'PLN' },
      target50: { amount: 40000, currency: 'PLN' },
      percentPaid: 50,
      fullyPaid: false,
      target50Reached: true,
    });
  });

  it('keeps the intro contract without a target', () => {
    const intro = toV2Project(project()).contracts.intro;
    expect(intro).toMatchObject({ target50: null, target50Reached: false, fullyPaid: true });
  });

  it('attaches every payment to its own contract', () => {
    const payments = toV2Project(project()).payments;
    expect(payments.map((payment) => payment.contractKind)).toEqual(['intro', 'main']);
    expect(payments[1]).toMatchObject({
      amount: { amount: 39500, currency: 'PLN' },
      sharePercent: 49,
    });
  });

  it('maps the estimate lines, totals and lock', () => {
    const { estimate } = toV2Project(project());
    expect(estimate.lines.kitchen).toEqual({
      money: { amount: 60000, currency: 'PLN' },
      note: 'Oak',
    });
    expect(estimate.lines.appliances).toBeNull();
    expect(estimate.totals).toHaveLength(2);
    expect(estimate.locked).toBe(true);
  });

  it('maps a project without contracts, event, manager or intro default', () => {
    const mapped = toV2Project(
      project({
        contracts: { intro: null, main: null },
        contract: null,
        payments: [],
        eventDate: null,
        manager: null,
        introDefault: null,
      }),
    );
    expect(mapped).toMatchObject({
      contracts: { intro: null, main: null },
      payments: [],
      schedule: null,
      manager: null,
      introDefault: null,
    });
  });

  it('keeps the event time, the client name and the designer', () => {
    const mapped = toV2Project(
      project({ eventTime: '10:00', designer: { id: 'd1', name: 'Ola Lis' } }),
    );
    expect(mapped.schedule).toEqual({ date: '2026-10-05', time: '10:00' });
    expect(mapped.clientName).toBe('Marta Zielińska');
    expect(mapped.designer).toEqual({ id: 'd1', name: 'Ola Lis' });
  });

  it('reads the previous status of a cancellation and the permission', () => {
    const mapped = toV2Project(
      project({
        status: 'cancelled',
        permissions: { canEdit: false },
        cancellation: {
          cancelledAt: '2026-09-28T10:12:00Z',
          cancelledBy: 'm1',
          cancelledByName: 'Paweł Mazur',
          reasons: ['postponed_renovation'],
          comment: null,
          statusBeforeCancel: 'design',
        },
      }),
    );
    expect(mapped.cancellation).toMatchObject({ previousStatus: 'design', comment: null });
    expect(mapped.canEdit).toBe(false);
  });

  it('drops an unknown status before cancel', () => {
    const mapped = toV2Project(
      project({
        cancellation: {
          cancelledAt: '2026-09-28T10:12:00Z',
          cancelledBy: null,
          cancelledByName: 'Paweł Mazur',
          reasons: ['other'],
          comment: 'x',
          statusBeforeCancel: 'express',
        },
      }),
    );
    expect(mapped.cancellation?.previousStatus).toBeNull();
  });
});

describe('toV2ProjectListItem', () => {
  it('maps the event to a schedule', () => {
    const item: ProjectListItem = {
      id: 'p1',
      leadId: 'l1',
      clientId: null,
      code: 'W0231',
      clientName: 'Marta Zielińska',
      products: ['kitchen'],
      status: 'measure',
      projectType: null,
      eventDate: '2026-09-29',
      eventTime: '10:00',
      manager: null,
      designer: null,
      estimateTotals: [{ amount: 90000, currency: 'PLN' }],
      createdAt: '2026-09-24T10:00:00Z',
      lastComment: null,
    };
    expect(toV2ProjectListItem(item)).toMatchObject({
      schedule: { date: '2026-09-29', time: '10:00' },
      manager: null,
      estimateTotals: [{ amount: 90000, currency: 'PLN' }],
      lastComment: null,
    });
  });
});

describe('toV2ProjectFacets', () => {
  it('fills the statuses the API leaves out with 0', () => {
    const facets = toV2ProjectFacets({ total: 5, status: { estimate: 2, cancelled: 1 } });
    expect(facets.total).toBe(5);
    expect(facets.status).toEqual({
      estimate: 2,
      intro_contract: 0,
      measure: 0,
      design: 0,
      main_contract: 0,
      prepayment: 0,
      factory: 0,
      production: 0,
      final_payment: 0,
      installation: 0,
      completed: 0,
      cancelled: 1,
    });
  });
});

describe('toV2ProjectBoard', () => {
  it('turns an empty next cursor into null', () => {
    const board = toV2ProjectBoard({
      total: 1,
      columns: [
        { status: 'estimate', count: 1, items: [], nextCursor: '' },
        { status: 'measure', count: 30, items: [], nextCursor: 'abc' },
      ],
    });
    expect(board.columns.map((column) => column.nextCursor)).toEqual([null, 'abc']);
  });
});

describe('project money', () => {
  it('rounds and clamps percentages', () => {
    expect(v2PercentOf(1, 3)).toBe(33);
    expect(v2PercentOf(120, 100)).toBe(100);
    expect(v2PercentOf(5, 0)).toBe(0);
  });

  it('groups thousands and shows decimals only when present', () => {
    expect(formatV2Money({ amount: 40000, currency: 'PLN' }, 'en')).toBe('40 000 zł');
    expect(formatV2Money({ amount: 1250.5, currency: 'EUR' }, 'en')).toBe('1 250.50 €');
    expect(formatV2Money({ amount: 1250.5, currency: 'UAH' }, 'uk')).toBe('1 250,50 ₴');
  });
});
