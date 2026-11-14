import {
  V2_PROJECT_STAGES,
  V2_PROJECT_STATUSES,
  v2IsChangeableProjectStatus,
  v2ProjectActions,
  v2ProjectNextEvent,
  v2ProjectStageState,
} from './project-status';
import type { V2Project } from './project.types';

const NOW = new Date(2026, 8, 28, 11, 20);

type ActionInput = Pick<V2Project, 'status' | 'canEdit'>;

const project = (patch: Partial<ActionInput>): ActionInput => ({
  status: 'measurement_design',
  canEdit: true,
  ...patch,
});

describe('project statuses', () => {
  it('has six stages and two finals (pipeline 4)', () => {
    expect(V2_PROJECT_STATUSES).toHaveLength(8);
    expect(V2_PROJECT_STAGES).toHaveLength(6);
    expect(V2_PROJECT_STAGES).not.toContain('completed');
    expect(V2_PROJECT_STAGES).not.toContain('cancelled');
  });

  it('lets users pick every stage but neither final', () => {
    expect(V2_PROJECT_STATUSES.filter(v2IsChangeableProjectStatus)).toEqual([...V2_PROJECT_STAGES]);
  });

  it('marks earlier tracker steps done and later ones upcoming', () => {
    expect(v2ProjectStageState('factory_approval', 'preliminary_estimate')).toBe('done');
    expect(v2ProjectStageState('factory_approval', 'factory_approval')).toBe('current');
    expect(v2ProjectStageState('factory_approval', 'installation')).toBe('upcoming');
  });

  it('completes every step once completed and none once closed', () => {
    expect(V2_PROJECT_STAGES.map((stage) => v2ProjectStageState('completed', stage))).toEqual(
      Array(6).fill('done'),
    );
    expect(V2_PROJECT_STAGES.map((stage) => v2ProjectStageState('cancelled', stage))).toEqual(
      Array(6).fill('upcoming'),
    );
  });
});

describe('next event', () => {
  const schedule = (date: string) => ({ date, time: '10:00' });

  it('is Closed for completed and closed projects', () => {
    expect(v2ProjectNextEvent({ status: 'completed', schedule: null }, NOW)).toEqual({
      kind: 'closed',
    });
    expect(
      v2ProjectNextEvent({ status: 'cancelled', schedule: schedule('2026-10-01') }, NOW),
    ).toEqual({ kind: 'closed' });
  });

  it('is Not planned without a date', () => {
    expect(v2ProjectNextEvent({ status: 'installation', schedule: null }, NOW).kind).toBe(
      'notPlanned',
    );
  });

  it('names the event after the stage, with a generic name for factory approval', () => {
    expect(
      v2ProjectNextEvent({ status: 'contract_signing', schedule: schedule('2026-09-29') }, NOW),
    ).toEqual({
      kind: 'planned',
      labelKey: 'v2.project.nextEvent.contract_signing',
      schedule: schedule('2026-09-29'),
      overdue: false,
    });
    expect(
      v2ProjectNextEvent({ status: 'factory_approval', schedule: schedule('2026-09-29') }, NOW),
    ).toMatchObject({ labelKey: 'v2.project.nextEvent.generic' });
  });

  it('is overdue only when the day has passed, today is not late', () => {
    const at = (date: string, done?: boolean) =>
      v2ProjectNextEvent({ status: 'measurement_design', schedule: schedule(date), done }, NOW);
    expect(at('2026-09-24')).toMatchObject({ overdue: true });
    expect(at('2026-09-28')).toMatchObject({ overdue: false });
    expect(at('2026-09-24', true)).toMatchObject({ overdue: false });
  });
});

describe('project actions', () => {
  it('lets the manager change, pay, estimate and close, but finish only from installation', () => {
    expect(v2ProjectActions(project({}))).toEqual({
      canChangeStatus: true,
      canAddPayment: true,
      canEditEstimate: true,
      canCancel: true,
      canFinish: false,
      canRestore: false,
      canComment: true,
      canUploadDocument: true,
      lockReason: null,
    });
    expect(v2ProjectActions(project({ status: 'installation' })).canFinish).toBe(true);
  });

  it('locks a viewer out of every change but comments and documents', () => {
    expect(v2ProjectActions(project({ canEdit: false, status: 'installation' }))).toEqual({
      canChangeStatus: false,
      canAddPayment: false,
      canEditEstimate: false,
      canCancel: false,
      canFinish: false,
      canRestore: false,
      canComment: true,
      canUploadDocument: true,
      lockReason: 'viewer',
    });
  });

  it('leaves only Restore on a closed or completed project', () => {
    for (const status of ['cancelled', 'completed'] as const) {
      expect(v2ProjectActions(project({ status }))).toEqual({
        canChangeStatus: false,
        canAddPayment: false,
        canEditEstimate: false,
        canCancel: false,
        canFinish: false,
        canRestore: true,
        canComment: false,
        canUploadDocument: false,
        lockReason: status,
      });
    }
    expect(v2ProjectActions(project({ status: 'cancelled', canEdit: false })).canRestore).toBe(
      false,
    );
  });
});
