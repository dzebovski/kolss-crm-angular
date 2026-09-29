import type { Project, ProjectListItem } from '@core/api/generated/kolss-api.types';
import { formatV2Money, v2PercentOf } from './project-money';
import { toV2Project, toV2ProjectFacets, toV2ProjectListItem } from './project.mapper';

const project = (patch: Partial<Project> = {}): Project => ({
  id: 'p1',
  leadId: 'l1',
  officeId: 'o1',
  code: 'W0231',
  status: 'contract',
  projectType: 'measure',
  eventDate: '2026-10-05',
  eventTime: null,
  statusDetails: {},
  manager: { id: 'm1', name: 'Kasia Nowak' },
  client: { name: 'Marta Zielińska', phone: '+48 601 334 812', email: null, cityRegion: null },
  createdAt: '2026-09-24T10:00:00Z',
  createdByName: 'Kasia Nowak',
  statusChangedAt: '2026-09-25T10:00:00Z',
  lastActivityAt: '2026-09-25T10:00:00Z',
  cancellation: null,
  contract: {
    id: 'c1',
    number: 'KW/2026/041',
    signedOn: '2026-09-25',
    totalAmount: 80000,
    currency: 'PLN',
    paidAmount: 40000,
    remainingAmount: 40000,
    file: { id: 'f1', fileName: 'contract.pdf', sizeBytes: 1024 },
  },
  payments: [
    {
      id: 'pay1',
      amount: 40000,
      paidOn: '2026-09-25',
      note: '50% prepayment',
      createdAt: '2026-09-25T16:10:00Z',
      createdByName: 'Kasia Nowak',
      file: null,
    },
  ],
  permissions: { canEdit: true },
  ...patch,
});

describe('toV2Project', () => {
  it('turns contract money into amount + currency with paid, remaining and percent', () => {
    const mapped = toV2Project(project());
    expect(mapped.contract).toMatchObject({
      total: { amount: 80000, currency: 'PLN' },
      paid: { amount: 40000, currency: 'PLN' },
      remaining: { amount: 40000, currency: 'PLN' },
      percentPaid: 50,
      fullyPaid: false,
    });
    expect(mapped.payments[0]).toMatchObject({
      amount: { amount: 40000, currency: 'PLN' },
      sharePercent: 50,
    });
  });

  it('marks a fully paid contract', () => {
    const base = project();
    const mapped = toV2Project(
      project({
        contract: { ...base.contract!, paidAmount: 80000, remainingAmount: 0 },
      }),
    );
    expect(mapped.contract).toMatchObject({ percentPaid: 100, fullyPaid: true });
  });

  it('maps a project without a contract, event or manager', () => {
    const mapped = toV2Project(
      project({ contract: null, payments: [], eventDate: null, manager: null }),
    );
    expect(mapped).toMatchObject({ contract: null, payments: [], schedule: null, manager: null });
  });

  it('keeps the event time and the client name', () => {
    const mapped = toV2Project(project({ eventTime: '10:00' }));
    expect(mapped.schedule).toEqual({ date: '2026-10-05', time: '10:00' });
    expect(mapped.clientName).toBe('Marta Zielińska');
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
          statusBeforeCancel: 'legacy',
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
      code: 'W0231',
      clientName: 'Marta Zielińska',
      products: ['kitchen'],
      status: 'measure',
      projectType: null,
      eventDate: '2026-09-29',
      eventTime: '10:00',
      manager: null,
      createdAt: '2026-09-24T10:00:00Z',
      lastComment: null,
    };
    expect(toV2ProjectListItem(item)).toMatchObject({
      schedule: { date: '2026-09-29', time: '10:00' },
      manager: null,
      lastComment: null,
    });
  });
});

describe('toV2ProjectFacets', () => {
  it('fills the statuses the API leaves out with 0', () => {
    const facets = toV2ProjectFacets({ total: 5, status: { express: 2, cancelled: 1 } });
    expect(facets.total).toBe(5);
    expect(facets.status).toEqual({
      none: 0,
      express: 2,
      measure: 0,
      design: 0,
      contract: 0,
      production: 0,
      installation: 0,
      completed: 0,
      cancelled: 1,
    });
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
