import type { MessageKey } from '@core/i18n/messages';
import type { ProjectStageDetails } from '@core/api/generated/kolss-api.types';
import type { V2Project, V2ProjectSchedule, V2ProjectStatus, V2ProjectType } from './project.types';

/** Every status, in the order the API documents them (`none` first, `cancelled` last). */
export const V2_PROJECT_STATUSES: readonly V2ProjectStatus[] = [
  'none',
  'express',
  'measure',
  'design',
  'contract',
  'production',
  'installation',
  'completed',
  'cancelled',
];

/** The seven steps of the stage tracker and the status cards of Change status, in order. */
export const V2_PROJECT_STAGES = [
  'express',
  'measure',
  'design',
  'contract',
  'production',
  'installation',
  'completed',
] as const satisfies readonly V2ProjectStatus[];

export type V2ProjectStage = (typeof V2_PROJECT_STAGES)[number];

/** Status chips of the list: the stages, then Cancelled, then Status not set (Projects-list board). */
export const V2_PROJECT_FILTER_ORDER: readonly V2ProjectStatus[] = [
  ...V2_PROJECT_STAGES,
  'cancelled',
  'none',
];

/**
 * Colours of the status dot and stage circle. Most reuse the lead status tokens (the boards
 * use the same hex values); `production` and `installation` have their own tokens.
 */
export const V2_PROJECT_STATUS_COLOR: Readonly<Record<V2ProjectStatus, string>> = {
  none: 'var(--v2-faint)',
  express: 'var(--v2-status-thinking)',
  measure: 'var(--v2-status-later)',
  design: 'var(--v2-status-invited)',
  contract: 'var(--v2-status-success)',
  production: 'var(--v2-status-production)',
  installation: 'var(--v2-status-installation)',
  completed: 'var(--v2-status-project)',
  cancelled: 'var(--v2-status-lost)',
};

/** `contract` is set only by Add contract, `cancelled` only by Cancel project, `none` at creation. */
const CHANGEABLE: readonly V2ProjectStatus[] = [
  'express',
  'measure',
  'design',
  'production',
  'installation',
  'completed',
];

const NEXT_EVENT_KEY: Partial<Record<V2ProjectStatus, MessageKey>> = {
  express: 'v2.project.nextEvent.express',
  measure: 'v2.project.nextEvent.measure',
  design: 'v2.project.nextEvent.design',
  contract: 'v2.project.nextEvent.contract',
  production: 'v2.project.nextEvent.production',
  installation: 'v2.project.nextEvent.installation',
};

/** What the first status is for each "Project type" of Create project (`none` without a type). */
const FIRST_STATUS: Record<V2ProjectType, V2ProjectStatus> = {
  express: 'express',
  measure: 'measure',
  contract: 'design',
};

export function v2ProjectStatusLabelKey(status: V2ProjectStatus): MessageKey {
  return `v2.project.status.${status}`;
}

/** Name of the status' next event (Estimate deadline, Measurement visit …); null when it has none. */
export function v2ProjectNextEventLabelKey(status: V2ProjectStatus): MessageKey | null {
  return NEXT_EVENT_KEY[status] ?? null;
}

export function v2ProjectFirstStatus(type: V2ProjectType | null): V2ProjectStatus {
  return type ? FIRST_STATUS[type] : 'none';
}

/** Create project with "Contract signing" opens Add contract right after creation. */
export function v2ProjectOpensAddContract(type: V2ProjectType | null): boolean {
  return type === 'contract';
}

/** Statuses a user can pick in Change status. */
export function v2IsChangeableProjectStatus(status: V2ProjectStatus): boolean {
  return CHANGEABLE.includes(status);
}

/** Position in the stage tracker (0–6); -1 for `none` and `cancelled`. */
export function v2ProjectStageIndex(status: V2ProjectStatus): number {
  return (V2_PROJECT_STAGES as readonly V2ProjectStatus[]).indexOf(status);
}

export type V2ProjectStageState = 'done' | 'current' | 'upcoming';

/** One step of the tracker: earlier steps are done, no step is done for `none` / `cancelled`. */
export function v2ProjectStageState(
  status: V2ProjectStatus,
  stage: V2ProjectStage,
): V2ProjectStageState {
  const current = v2ProjectStageIndex(status);
  const index = V2_PROJECT_STAGES.indexOf(stage);
  if (index === current) return 'current';
  return current > index ? 'done' : 'upcoming';
}

/** Completed and Cancelled projects have no next event ("Closed" in the list). */
export function v2IsProjectClosed(status: V2ProjectStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

/** Whether the stage's own work is logged (Done / Took place ticked); only express and measure have it. */
export function v2ProjectStageDone(status: V2ProjectStatus, details: ProjectStageDetails): boolean {
  if (status === 'express') return details.express?.done === true;
  if (status === 'measure') return details.measure?.done === true;
  return false;
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
 * `done` is the express / measure "Done" flag, which the list does not have (pass `false`).
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

export type V2ProjectLockReason = 'viewer' | 'cancelled';

export interface V2ProjectActions {
  readonly canChangeStatus: boolean;
  readonly canAddContract: boolean;
  readonly canAddPayment: boolean;
  readonly canCancel: boolean;
  readonly canRestore: boolean;
  /**
   * Why the buttons are disabled: `viewer` shows the read-only hint under the status bar (and as a
   * tooltip on the buttons), `cancelled` the grey banner. Null while the user can act.
   */
  readonly lockReason: V2ProjectLockReason | null;
}

/**
 * Which project buttons are enabled. Mirrors the API: only the manager and admins act
 * (`canEdit`), a cancelled project only accepts Restore, one contract per project, payments
 * need a contract with something left to pay. Comments and documents are open to everyone.
 */
export function v2ProjectActions(
  project: Pick<V2Project, 'status' | 'canEdit' | 'contract'>,
): V2ProjectActions {
  const cancelled = project.status === 'cancelled';
  const active = project.canEdit && !cancelled;
  return {
    canChangeStatus: active,
    canAddContract: active && project.contract === null,
    canAddPayment: active && project.contract !== null && project.contract.remaining.amount > 0,
    canCancel: active,
    canRestore: project.canEdit && cancelled,
    lockReason: !project.canEdit ? 'viewer' : cancelled ? 'cancelled' : null,
  };
}

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
