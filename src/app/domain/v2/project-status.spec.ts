import {
  V2_PROJECT_STAGES,
  V2_PROJECT_STATUSES,
  v2IsChangeableProjectStatus,
  v2ProjectActions,
  v2ProjectNextEvent,
  v2ProjectStageDone,
  v2ProjectStageState,
} from './project-status';
import type { V2Project, V2ProjectContract, V2ProjectEstimate } from './project.types';

const NOW = new Date(2026, 8, 28, 11, 20);

const contract = (kind: 'intro' | 'main', remaining: number): V2ProjectContract => ({
  id: kind,
  kind,
  number: 'KW/2026/041',
  signedOn: '2026-09-25',
  total: { amount: 80000, currency: 'PLN' },
  paid: { amount: 80000 - remaining, currency: 'PLN' },
  credited: { amount: 0, currency: 'PLN' },
  remaining: { amount: remaining, currency: 'PLN' },
  target50: kind === 'main' ? { amount: 40000, currency: 'PLN' } : null,
  percentPaid: 0,
  fullyPaid: remaining === 0,
  target50Reached: false,
  file: null,
});

const estimate = (locked: boolean): V2ProjectEstimate => ({
  lines: { kitchen: null, appliances: null, installation: null, countertop: null },
  totals: [],
  locked,
});

type ActionInput = Pick<V2Project, 'status' | 'canEdit' | 'contracts' | 'estimate'>;

const project = (patch: Partial<ActionInput>): ActionInput => ({
  status: 'design',
  canEdit: true,
  contracts: { intro: null, main: null },
  estimate: estimate(false),
  ...patch,
});

describe('project statuses', () => {
  it('has twelve statuses and an eleven-step tracker without Cancelled', () => {
    expect(V2_PROJECT_STATUSES).toHaveLength(12);
    expect(V2_PROJECT_STAGES).toHaveLength(11);
    expect(V2_PROJECT_STATUSES.at(-1)).toBe('cancelled');
    expect(V2_PROJECT_STAGES).not.toContain('cancelled');
  });

  it('lets users pick every stage except the two contract stages', () => {
    const pickable = V2_PROJECT_STATUSES.filter(v2IsChangeableProjectStatus);
    expect(pickable).toEqual([
      'estimate',
      'measure',
      'design',
      'prepayment',
      'factory',
      'production',
      'final_payment',
      'installation',
      'completed',
    ]);
  });

  it('marks earlier tracker steps done and later ones upcoming', () => {
    expect(v2ProjectStageState('design', 'estimate')).toBe('done');
    expect(v2ProjectStageState('design', 'design')).toBe('current');
    expect(v2ProjectStageState('design', 'main_contract')).toBe('upcoming');
    expect(v2ProjectStageState('completed', 'installation')).toBe('done');
  });

  it('completes no step for Cancelled', () => {
    expect(V2_PROJECT_STAGES.map((stage) => v2ProjectStageState('cancelled', stage))).toEqual(
      Array(11).fill('upcoming'),
    );
  });
});

describe('next event', () => {
  const schedule = (date: string) => ({ date, time: '10:00' });

  it('is Closed for completed and cancelled projects', () => {
    expect(v2ProjectNextEvent({ status: 'completed', schedule: null }, NOW)).toEqual({
      kind: 'closed',
    });
    expect(
      v2ProjectNextEvent({ status: 'cancelled', schedule: schedule('2026-10-01') }, NOW),
    ).toEqual({ kind: 'closed' });
  });

  it('is Not planned without a date', () => {
    expect(v2ProjectNextEvent({ status: 'design', schedule: null }, NOW).kind).toBe('notPlanned');
  });

  it('names the event after the status, with a generic name for the other stages', () => {
    expect(
      v2ProjectNextEvent({ status: 'measure', schedule: schedule('2026-09-29') }, NOW),
    ).toEqual({
      kind: 'planned',
      labelKey: 'v2.project.nextEvent.measure',
      schedule: schedule('2026-09-29'),
      overdue: false,
    });
    expect(
      v2ProjectNextEvent({ status: 'factory', schedule: schedule('2026-09-29') }, NOW),
    ).toMatchObject({ labelKey: 'v2.project.nextEvent.generic' });
  });

  it('is overdue only when the day has passed, today is not late', () => {
    const at = (date: string, done?: boolean) =>
      v2ProjectNextEvent({ status: 'measure', schedule: schedule(date), done }, NOW);
    expect(at('2026-09-24')).toMatchObject({ overdue: true });
    expect(at('2026-09-28')).toMatchObject({ overdue: false });
    expect(at('2026-09-24', true)).toMatchObject({ overdue: false });
  });

  it('reads the Took place flag of the measurement only', () => {
    expect(v2ProjectStageDone('measure', { measure: { done: true } })).toBe(true);
    expect(v2ProjectStageDone('design', { measure: { done: true } })).toBe(false);
  });
});

describe('project actions', () => {
  it('lets the manager change, add either contract, edit the estimate and cancel', () => {
    expect(v2ProjectActions(project({}))).toEqual({
      canChangeStatus: true,
      canAddIntroContract: true,
      canAddMainContract: true,
      canAddPayment: false,
      canEditEstimate: true,
      canCancel: true,
      canRestore: false,
      canComment: true,
      lockReason: null,
    });
  });

  it('allows one contract of each kind and payments while something is left to pay', () => {
    const intro = project({ contracts: { intro: contract('intro', 100), main: null } });
    expect(v2ProjectActions(intro)).toMatchObject({
      canAddIntroContract: false,
      canAddMainContract: true,
      canAddPayment: true,
    });
    const paid = project({
      contracts: { intro: contract('intro', 0), main: contract('main', 0) },
    });
    expect(v2ProjectActions(paid)).toMatchObject({
      canAddMainContract: false,
      canAddPayment: false,
    });
  });

  it('locks the estimate once the server says so', () => {
    expect(v2ProjectActions(project({ estimate: estimate(true) })).canEditEstimate).toBe(false);
  });

  it('locks a viewer out of every action but comments', () => {
    expect(v2ProjectActions(project({ canEdit: false }))).toEqual({
      canChangeStatus: false,
      canAddIntroContract: false,
      canAddMainContract: false,
      canAddPayment: false,
      canEditEstimate: false,
      canCancel: false,
      canRestore: false,
      canComment: true,
      lockReason: 'viewer',
    });
  });

  it('leaves only Restore on a cancelled project, which refuses comments', () => {
    expect(v2ProjectActions(project({ status: 'cancelled' }))).toEqual({
      canChangeStatus: false,
      canAddIntroContract: false,
      canAddMainContract: false,
      canAddPayment: false,
      canEditEstimate: false,
      canCancel: false,
      canRestore: true,
      canComment: false,
      lockReason: 'cancelled',
    });
    expect(v2ProjectActions(project({ status: 'cancelled', canEdit: false })).canRestore).toBe(
      false,
    );
  });
});
