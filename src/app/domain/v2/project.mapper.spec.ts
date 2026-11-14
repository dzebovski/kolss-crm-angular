import type { Project, ProjectListItem } from '@core/api/generated/kolss-api.types';
import {
  formatV2Money,
  v2PaymentsNewestFirst,
  v2PercentOf,
  v2ProjectBalance,
  v2ProjectMoneyCell,
} from './project-money';
import {
  toV2Project,
  toV2ProjectBoard,
  toV2ProjectFacets,
  toV2ProjectListItem,
} from './project.mapper';

const project = (patch: Partial<Project> = {}): Project => ({
  id: 'p1',
  leadId: 'l1',
  clientId: 'cl1',
  officeId: 'o1',
  code: 'W0231',
  status: 'contract_signing',
  projectType: 'measure',
  eventDate: '2026-10-05',
  eventTime: null,
  manager: { id: 'm1', name: 'Kasia Nowak' },
  designer: null,
  client: { name: 'Marta Zielińska', phone: '+48 601 334 812', email: null, cityRegion: null },
  description: '  Kitchen and wardrobe  ',
  createdAt: '2026-09-24T10:00:00Z',
  createdByName: 'Kasia Nowak',
  statusChangedAt: '2026-09-25T10:00:00Z',
  lastActivityAt: '2026-09-25T10:00:00Z',
  cancellation: null,
  estimate: { amount: 63000, currency: 'PLN' },
  paidTotals: [{ amount: 500, currency: 'PLN' }],
  payments: [
    {
      id: 'pay0',
      amount: 500,
      currency: 'PLN',
      paidOn: '2026-09-20',
      basis: 'receipt',
      note: null,
      createdAt: '2026-09-20T16:10:00Z',
      createdByName: 'Kasia Nowak',
      file: { id: 'f1', fileName: 'receipt.pdf', sizeBytes: 1024 },
    },
  ],
  documents: [
    {
      id: 'd1',
      fileName: 'contract.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      createdAt: '2026-09-25T10:00:00Z',
      uploadedBy: { id: 'm1', name: 'Kasia Nowak' },
    },
  ],
  permissions: { canEdit: true },
  ...patch,
});

describe('toV2Project', () => {
  it('maps payments with their own currency and basis', () => {
    expect(toV2Project(project()).payments[0]).toMatchObject({
      amount: { amount: 500, currency: 'PLN' },
      basis: 'receipt',
      file: { id: 'f1', fileName: 'receipt.pdf', sizeBytes: 1024 },
    });
  });

  it('maps the estimate total, paid totals, documents and trimmed description', () => {
    const mapped = toV2Project(project());
    expect(mapped.estimate).toEqual({ amount: 63000, currency: 'PLN' });
    expect(mapped.paidTotals).toEqual([{ amount: 500, currency: 'PLN' }]);
    expect(mapped.documents[0]).toMatchObject({ id: 'd1', uploadedBy: { id: 'm1' } });
    expect(mapped.description).toBe('Kitchen and wardrobe');
  });

  it('maps a project without estimate, event, manager or description', () => {
    const mapped = toV2Project(
      project({ estimate: null, eventDate: null, manager: null, description: ' ' }),
    );
    expect(mapped).toMatchObject({
      estimate: null,
      schedule: null,
      manager: null,
      description: null,
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
          statusBeforeCancel: 'measurement_design',
        },
      }),
    );
    expect(mapped.cancellation).toMatchObject({
      previousStatus: 'measurement_design',
      comment: null,
    });
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
          statusBeforeCancel: 'design',
        },
      }),
    );
    expect(mapped.cancellation?.previousStatus).toBeNull();
  });
});

describe('toV2ProjectListItem', () => {
  it('maps the event to a schedule and keeps the money', () => {
    const item: ProjectListItem = {
      id: 'p1',
      leadId: 'l1',
      clientId: null,
      code: 'W0231',
      clientName: 'Marta Zielińska',
      products: ['kitchen'],
      status: 'measurement_design',
      projectType: null,
      eventDate: '2026-09-29',
      eventTime: '10:00',
      manager: null,
      designer: null,
      estimate: { amount: 90000, currency: 'PLN' },
      paidTotals: [],
      createdAt: '2026-09-24T10:00:00Z',
      lastComment: null,
    };
    expect(toV2ProjectListItem(item)).toMatchObject({
      schedule: { date: '2026-09-29', time: '10:00' },
      manager: null,
      estimate: { amount: 90000, currency: 'PLN' },
      paidTotals: [],
      lastComment: null,
    });
  });
});

describe('toV2ProjectFacets', () => {
  it('fills the statuses the API leaves out with 0', () => {
    const facets = toV2ProjectFacets({
      total: 5,
      status: { preliminary_estimate: 2, cancelled: 1 },
    });
    expect(facets.total).toBe(5);
    expect(facets.status).toEqual({
      preliminary_estimate: 2,
      measurement_design: 0,
      factory_approval: 0,
      contract_signing: 0,
      production_delivery: 0,
      installation: 0,
      completed: 0,
      cancelled: 1,
    });
  });
});

describe('toV2ProjectBoard', () => {
  it('turns an empty next cursor into null and keeps the final counts', () => {
    const board = toV2ProjectBoard({
      total: 1,
      completedCount: 2,
      cancelledCount: 3,
      columns: [
        { status: 'preliminary_estimate', count: 1, items: [], nextCursor: '' },
        { status: 'measurement_design', count: 30, items: [], nextCursor: 'abc' },
      ],
    });
    expect(board.columns.map((column) => column.nextCursor)).toEqual([null, 'abc']);
    expect(board.completedCount).toBe(2);
    expect(board.cancelledCount).toBe(3);
  });
});

describe('project money', () => {
  it('rounds and clamps percentages', () => {
    expect(v2PercentOf(1, 3)).toBe(33);
    expect(v2PercentOf(120, 100)).toBe(100);
    expect(v2PercentOf(5, 0)).toBe(0);
  });

  it('groups thousands and shows decimals only when present', () => {
    expect(formatV2Money({ amount: 40000, currency: 'PLN' }, 'en')).toBe('40\u00a0000\u00a0zł');
    expect(formatV2Money({ amount: 1250.5, currency: 'EUR' }, 'en')).toBe('1\u00a0250.50\u00a0€');
    expect(formatV2Money({ amount: 1250.5, currency: 'UAH' }, 'uk')).toBe('1\u00a0250,50\u00a0₴');
  });

  it('counts the remaining amount in the estimate currency only', () => {
    const pln = (amount: number) => ({ amount, currency: 'PLN' as const });
    expect(v2ProjectBalance(null, [pln(10)])).toBeNull();
    expect(v2ProjectBalance(pln(1000.1), [pln(500.05), { amount: 20, currency: 'EUR' }])).toEqual({
      paid: pln(500.05),
      remaining: pln(500.05),
      otherCurrencies: true,
    });
    expect(v2ProjectBalance(pln(100), [pln(150)])?.remaining).toEqual(pln(-50));
  });

  it('builds the Estimate · paid cell of the list', () => {
    const pln = (amount: number) => ({ amount, currency: 'PLN' as const });
    expect(
      v2ProjectMoneyCell(pln(40000), [pln(12000), { amount: 0, currency: 'EUR' }], 'en'),
    ).toEqual({
      estimate: '40\u00a0000\u00a0zł',
      paid: '12\u00a0000\u00a0zł',
      percent: 30,
    });
    expect(v2ProjectMoneyCell(null, [], 'en')).toEqual({
      estimate: null,
      paid: null,
      percent: null,
    });
    expect(
      v2ProjectMoneyCell(pln(100), [{ amount: 50, currency: 'EUR' }], 'en').percent,
    ).toBeNull();
  });

  it('sorts payments by day, then by entry time', () => {
    const base = toV2Project(project()).payments[0];
    const sorted = v2PaymentsNewestFirst([
      { ...base, id: 'a', paidOn: '2026-09-01', createdAt: '2026-09-03T10:00:00Z' },
      { ...base, id: 'b', paidOn: '2026-09-02', createdAt: '2026-09-02T10:00:00Z' },
      { ...base, id: 'c', paidOn: '2026-09-01', createdAt: '2026-09-04T10:00:00Z' },
    ]);
    expect(sorted.map((payment) => payment.id)).toEqual(['b', 'c', 'a']);
  });
});
