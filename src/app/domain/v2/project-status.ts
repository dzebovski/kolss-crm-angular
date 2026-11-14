import type { MessageKey } from '@core/i18n/messages';
import type { V2Project, V2ProjectSchedule, V2ProjectStatus } from './project.types';

/**
 * Every status in pipeline order, then the finals. Pipeline 4 (owner decision 2026-11-14, API
 * 2.43.0): six stages moved by hand in both directions; meetings, tasks and calls are events, not
 * stages; payments and documents do not move the stage.
 */
export const V2_PROJECT_STATUSES: readonly V2ProjectStatus[] = [
  'preliminary_estimate',
  'measurement_design',
  'factory_approval',
  'contract_signing',
  'production_delivery',
  'installation',
  'completed',
  'cancelled',
];

/** The six steps of the stage tracker and the kanban columns. */
export const V2_PROJECT_STAGES = [
  'preliminary_estimate',
  'measurement_design',
  'factory_approval',
  'contract_signing',
  'production_delivery',
  'installation',
] as const satisfies readonly V2ProjectStatus[];

export type V2ProjectStage = (typeof V2_PROJECT_STAGES)[number];

/** Status chips of the list: the stages, then Completed and Closed (kanban filters). */
export const V2_PROJECT_FILTER_ORDER: readonly V2ProjectStatus[] = [
  ...V2_PROJECT_STAGES,
  'completed',
  'cancelled',
];

/** Colours of the status dot and stage circle, all from existing tokens. */
export const V2_PROJECT_STATUS_COLOR: Readonly<Record<V2ProjectStatus, string>> = {
  preliminary_estimate: 'var(--v2-status-thinking)',
  measurement_design: 'var(--v2-status-later)',
  factory_approval: 'var(--v2-status-invited)',
  contract_signing: 'var(--v2-status-success)',
  production_delivery: 'var(--v2-status-production)',
  installation: 'var(--v2-status-installation)',
  completed: 'var(--v2-status-project)',
  cancelled: 'var(--v2-status-lost)',
};

/** Stages with their own name for the next event; every other open stage uses the generic one. */
const NEXT_EVENT_KEY: Partial<Record<V2ProjectStatus, MessageKey>> = {
  preliminary_estimate: 'v2.project.nextEvent.preliminary_estimate',
  measurement_design: 'v2.project.nextEvent.measurement_design',
  contract_signing: 'v2.project.nextEvent.contract_signing',
  production_delivery: 'v2.project.nextEvent.production_delivery',
  installation: 'v2.project.nextEvent.installation',
};

export function v2ProjectStatusLabelKey(status: V2ProjectStatus): MessageKey {
  return `v2.project.status.${status}`;
}

/** Name of the status' next event (Estimate deadline, Measurement visit …); null once closed. */
export function v2ProjectNextEventLabelKey(status: V2ProjectStatus): MessageKey | null {
  if (v2IsProjectClosed(status)) return null;
  return NEXT_EVENT_KEY[status] ?? 'v2.project.nextEvent.generic';
}

/** Statuses a user can pick in Change status: the six stages (backwards moves are allowed). */
export function v2IsChangeableProjectStatus(status: V2ProjectStatus): boolean {
  return v2ProjectStageIndex(status) >= 0;
}

/** Position in the stage tracker (0–5); -1 for the finals. */
export function v2ProjectStageIndex(status: V2ProjectStatus): number {
  return (V2_PROJECT_STAGES as readonly V2ProjectStatus[]).indexOf(status);
}

export type V2ProjectStageState = 'done' | 'current' | 'upcoming';

/**
 * One step of the tracker: earlier steps are done; every step is done once `completed`, none
 * for `cancelled` (the card shows the stage held before Close project instead).
 */
export function v2ProjectStageState(
  status: V2ProjectStatus,
  stage: V2ProjectStage,
): V2ProjectStageState {
  if (status === 'completed') return 'done';
  const current = v2ProjectStageIndex(status);
  const index = V2_PROJECT_STAGES.indexOf(stage);
  if (index === current) return 'current';
  return current > index ? 'done' : 'upcoming';
}

/** Completed and Cancelled projects have no next event ("Closed" in the list). */
export function v2IsProjectClosed(status: V2ProjectStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export type V2ProjectNextEvent =
  | { readonly kind: 'closed' }
  | { readonly kind: 'notPlanned' }
  | {
      readonly kind: 'planned';
      readonly labelKey: MessageKey;
      readonly schedule: V2ProjectSchedule;
      /** The date is before today and the stage is not marked done: "result not logged". */
      readonly overdue: boolean;
    };

/**
 * The list's "Next event" cell. Overdue compares calendar days (`now` is the viewer's local day);
 * `done` marks the event as held (e.g. a visited calendar appointment); the list passes nothing.
 */
export function v2ProjectNextEvent(
  input: {
    readonly status: V2ProjectStatus;
    readonly schedule: V2ProjectSchedule | null;
    readonly done?: boolean;
  },
  now: Date,
): V2ProjectNextEvent {
  if (v2IsProjectClosed(input.status)) return { kind: 'closed' };
  const labelKey = v2ProjectNextEventLabelKey(input.status);
  if (!labelKey || !input.schedule) return { kind: 'notPlanned' };
  return {
    kind: 'planned',
    labelKey,
    schedule: input.schedule,
    overdue: !input.done && input.schedule.date < localDay(now),
  };
}

export type V2ProjectLockReason = 'viewer' | 'cancelled' | 'completed';

export interface V2ProjectActions {
  readonly canChangeStatus: boolean;
  readonly canAddPayment: boolean;
  readonly canEditEstimate: boolean;
  /** Close project (cancel): any open project. */
  readonly canCancel: boolean;
  /** Project finished: only from Installation. */
  readonly canFinish: boolean;
  /** Reopen a completed or closed project. */
  readonly canRestore: boolean;
  /** Comments and documents are open to every user with office access while the project is open. */
  readonly canComment: boolean;
  readonly canUploadDocument: boolean;
  /**
   * Why the buttons are disabled: `viewer` shows the read-only hint, `cancelled` / `completed` the
   * grey banner. Null while the user can act.
   */
  readonly lockReason: V2ProjectLockReason | null;
}

/**
 * Which project buttons are enabled. Mirrors the API (2.43.0): only the manager and admins change
 * the project (`canEdit`); a completed or closed project only accepts Restore; Finish needs
 * Installation. Payment edit / delete follow `canChangeStatus`.
 */
export function v2ProjectActions(project: Pick<V2Project, 'status' | 'canEdit'>): V2ProjectActions {
  const final = v2IsProjectClosed(project.status);
  const active = project.canEdit && !final;
  return {
    canChangeStatus: active,
    canAddPayment: active,
    canEditEstimate: active,
    canCancel: active,
    canFinish: active && project.status === 'installation',
    canRestore: project.canEdit && final,
    canComment: !final,
    canUploadDocument: !final,
    lockReason: !project.canEdit
      ? 'viewer'
      : project.status === 'cancelled'
        ? 'cancelled'
        : project.status === 'completed'
          ? 'completed'
          : null,
  };
}

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
