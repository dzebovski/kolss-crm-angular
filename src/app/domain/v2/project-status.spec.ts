import {
  V2_PROJECT_STAGES,
  V2_PROJECT_STATUSES,
  v2IsChangeableProjectStatus,
  v2ProjectActions,
  v2ProjectFirstStatus,
  v2ProjectNextEvent,
  v2ProjectOpensAddContract,
  v2ProjectStageDone,
  v2ProjectStageState,
} from './project-status';
import type { V2Project, V2ProjectContract } from './project.types';

const NOW = new Date(2026, 8, 28, 11, 20);

const contract = (remaining: number): V2ProjectContract => ({
  id: 'c1',
  number: 'KW/2026/041',
  signedOn: '2026-09-25',
  total: { amount: 80000, currency: 'PLN' },
  paid: { amount: 80000 - remaining, currency: 'PLN' },
  remaining: { amount: remaining, currency: 'PLN' },
  percentPaid: 0,
  fullyPaid: remaining === 0,
  file: null,
});

const project = (
  patch: Partial<Pick<V2Project, 'status' | 'canEdit' | 'contract'>>,
): Pick<V2Project, 'status' | 'canEdit' | 'contract'> => ({
  status: 'design',
  canEdit: true,
  contract: null,
  ...patch,
});

describe('project statuses', () => {
  it('has nine statuses and a seven-step tracker', () => {
    expect(V2_PROJECT_STATUSES).toHaveLength(9);
    expect(V2_PROJECT_STAGES).toHaveLength(7);
  });

  it('sets the first status from the project type', () => {
    expect(v2ProjectFirstStatus('express')).toBe('express');
    expect(v2ProjectFirstStatus('measure')).toBe('measure');
    expect(v2ProjectFirstStatus('contract')).toBe('design');
    expect(v2ProjectFirstStatus(null)).toBe('none');
    expect(v2ProjectOpensAddContract('contract')).toBe(true);
    expect(v2ProjectOpensAddContract('measure')).toBe(false);
  });

  it('lets users pick everything except contract, cancelled and none', () => {
    const pickable = V2_PROJECT_STATUSES.filter(v2IsChangeableProjectStatus);
    expect(pickable).toEqual([
      'express',
      'measure',
      'design',
      'production',
      'installation',
      'completed',
    ]);
  });

  it('marks earlier tracker steps done and later ones upcoming', () => {
    expect(v2ProjectStageState('design', 'express')).toBe('done');
    expect(v2ProjectStageState('design', 'design')).toBe('current');
    expect(v2ProjectStageState('design', 'contract')).toBe('upcoming');
    expect(v2ProjectStageState('completed', 'installation')).toBe('done');
  });

  it('completes no step for Status not set or Cancelled', () => {
    for (const status of ['none', 'cancelled'] as const) {
      expect(V2_PROJECT_STAGES.map((stage) => v2ProjectStageState(status, stage))).toEqual(
        Array(7).fill('upcoming'),
      );
    }
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

  it('is Not planned without a date or a status event', () => {
    expect(v2ProjectNextEvent({ status: 'design', schedule: null }, NOW).kind).toBe('notPlanned');
    expect(v2ProjectNextEvent({ status: 'none', schedule: null }, NOW).kind).toBe('notPlanned');
  });

  it('names the event after the status', () => {
    expect(
      v2ProjectNextEvent({ status: 'measure', schedule: schedule('2026-09-29') }, NOW),
    ).toEqual({
      kind: 'planned',
      labelKey: 'v2.project.nextEvent.measure',
      schedule: schedule('2026-09-29'),
      overdue: false,
    });
  });

  it('is overdue only when the day has passed, today is not late', () => {
    const at = (date: string, done?: boolean) =>
      v2ProjectNextEvent({ status: 'measure', schedule: schedule(date), done }, NOW);
    expect(at('2026-09-24')).toMatchObject({ overdue: true });
    expect(at('2026-09-28')).toMatchObject({ overdue: false });
    expect(at('2026-09-24', true)).toMatchObject({ overdue: false });
  });

  it('reads the Done flag of express and measure only', () => {
    expect(v2ProjectStageDone('express', { express: { done: true } })).toBe(true);
    expect(v2ProjectStageDone('measure', { express: { done: true } })).toBe(false);
    expect(v2ProjectStageDone('design', { measure: { done: true } })).toBe(false);
  });
});

describe('project actions', () => {
  it('lets the manager change, add contract and cancel, but not pay without a contract', () => {
    expect(v2ProjectActions(project({}))).toEqual({
      canChangeStatus: true,
      canAddContract: true,
      canAddPayment: false,
      canCancel: true,
      canRestore: false,
      lockReason: null,
    });
  });

  it('allows one contract and payments only while something is left to pay', () => {
    expect(v2ProjectActions(project({ contract: contract(40000) }))).toMatchObject({
      canAddContract: false,
      canAddPayment: true,
    });
    expect(v2ProjectActions(project({ contract: contract(0) }))).toMatchObject({
      canAddPayment: false,
    });
  });

  it('locks a viewer out of every action', () => {
    expect(v2ProjectActions(project({ canEdit: false, contract: contract(1) }))).toEqual({
      canChangeStatus: false,
      canAddContract: false,
      canAddPayment: false,
      canCancel: false,
      canRestore: false,
      lockReason: 'viewer',
    });
  });

  it('leaves only Restore on a cancelled project', () => {
    expect(v2ProjectActions(project({ status: 'cancelled' }))).toEqual({
      canChangeStatus: false,
      canAddContract: false,
      canAddPayment: false,
      canCancel: false,
      canRestore: true,
      lockReason: 'cancelled',
    });
    expect(v2ProjectActions(project({ status: 'cancelled', canEdit: false })).canRestore).toBe(
      false,
    );
  });
});
