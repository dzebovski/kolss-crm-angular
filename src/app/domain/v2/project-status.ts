import type { MessageKey } from '@core/i18n/messages';
import type {
  V2Project,
  V2ProjectContract,
  V2ProjectSchedule,
  V2ProjectStatus,
} from './project.types';

/**
 * Every status in pipeline order, `cancelled` last. Pipeline 3 (owner decision 2026-11-07, API
 * 2.42.0): measurement and design are one stage; payments are shown on the card, not as stages.
 */
export const V2_PROJECT_STATUSES: readonly V2ProjectStatus[] = [
  'estimate',
  'showroom_meeting',
  'intro_contract',
  'design',
  'factory_review',
  'presentation',
  'main_contract',
  'production',
  'installation',
  'completed',
  'cancelled',
];

/** The ten steps of the stage tracker and the kanban columns (every status except `cancelled`). */
export const V2_PROJECT_STAGES = [
  'estimate',
  'showroom_meeting',
  'intro_contract',
  'design',
  'factory_review',
  'presentation',
  'main_contract',
  'production',
  'installation',
  'completed',
] as const satisfies readonly V2ProjectStatus[];

export type V2ProjectStage = (typeof V2_PROJECT_STAGES)[number];

/** Status chips of the list: the stages, then Cancelled (on the kanban Cancelled is a filter). */
export const V2_PROJECT_FILTER_ORDER: readonly V2ProjectStatus[] = [
  ...V2_PROJECT_STAGES,
  'cancelled',
];

/**
 * Colours of the status dot and stage circle, all from existing tokens. Client meetings
 * (showroom, presentation) share the violet of "Invited to showroom"; the contract stages the green
 * of "Successful call"; the factory review the teal of production.
 */
export const V2_PROJECT_STATUS_COLOR: Readonly<Record<V2ProjectStatus, string>> = {
  estimate: 'var(--v2-status-thinking)',
  showroom_meeting: 'var(--v2-status-invited)',
  intro_contract: 'var(--v2-status-success)',
  design: 'var(--v2-status-later)',
  factory_review: 'var(--v2-status-production)',
  presentation: 'var(--v2-status-invited)',
  main_contract: 'var(--v2-status-success)',
  production: 'var(--v2-status-production)',
  installation: 'var(--v2-status-installation)',
  completed: 'var(--v2-status-project)',
  cancelled: 'var(--v2-status-lost)',
};

/** `intro_contract` / `main_contract` are set only by Add contract, `cancelled` only by Cancel. */
const CHANGEABLE: readonly V2ProjectStatus[] = V2_PROJECT_STAGES.filter(
  (stage) => stage !== 'intro_contract' && stage !== 'main_contract',
);

/** Stages with their own name for the next event; every other open stage uses the generic one. */
const NEXT_EVENT_KEY: Partial<Record<V2ProjectStatus, MessageKey>> = {
  estimate: 'v2.project.nextEvent.estimate',
  showroom_meeting: 'v2.project.nextEvent.showroom_meeting',
  design: 'v2.project.nextEvent.design',
  presentation: 'v2.project.nextEvent.presentation',
  production: 'v2.project.nextEvent.production',
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

/** Statuses a user can pick in Change status (backwards moves are allowed). */
export function v2IsChangeableProjectStatus(status: V2ProjectStatus): boolean {
  return CHANGEABLE.includes(status);
}

/** Position in the stage tracker (0–9); -1 for `cancelled`. */
export function v2ProjectStageIndex(status: V2ProjectStatus): number {
  return (V2_PROJECT_STAGES as readonly V2ProjectStatus[]).indexOf(status);
}

export type V2ProjectStageState = 'done' | 'current' | 'upcoming';

/** One step of the tracker: earlier steps are done, no step is done for `cancelled`. */
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

/**
 * 50% rule (pipeline 3, API 2.42.0): moving from a stage before Production to Production or later
 * needs paid + credited ≥ 50% of the main contract total; no main contract counts as 0%.
 * `blocked` — a manager cannot move (the API answers 409 `prepayment_required`);
 * `needsComment` — an office admin / super admin may move with a required comment.
 * `isAdmin` must come from `@core/policy` (server permissions), never from the role string.
 */
export type V2PrepaymentCheck = 'ok' | 'blocked' | 'needsComment';

export function v2ProjectPrepaymentCheck(input: {
  readonly current: V2ProjectStatus;
  readonly next: V2ProjectStatus;
  readonly main: Pick<V2ProjectContract, 'target50Reached'> | null;
  readonly isAdmin: boolean;
}): V2PrepaymentCheck {
  const production = v2ProjectStageIndex('production');
  const crosses =
    v2ProjectStageIndex(input.current) < production &&
    v2ProjectStageIndex(input.next) >= production;
  if (!crosses || input.main?.target50Reached === true) return 'ok';
  return input.isAdmin ? 'needsComment' : 'blocked';
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

export type V2ProjectLockReason = 'viewer' | 'cancelled';

export interface V2ProjectActions {
  readonly canChangeStatus: boolean;
  readonly canAddIntroContract: boolean;
  readonly canAddMainContract: boolean;
  readonly canAddPayment: boolean;
  /** Estimate lines can be edited until a main contract exists. */
  readonly canEditEstimate: boolean;
  readonly canCancel: boolean;
  readonly canRestore: boolean;
  /** Comments are open to every user with office access; only a cancelled project refuses them. */
  readonly canComment: boolean;
  /**
   * Why the buttons are disabled: `viewer` shows the read-only hint under the status bar (and as a
   * tooltip on the buttons), `cancelled` the grey banner. Null while the user can act.
   */
  readonly lockReason: V2ProjectLockReason | null;
}

/**
 * Which project buttons are enabled. Mirrors the API: only the manager and admins act
 * (`canEdit`), a cancelled project only accepts Restore, one contract of each kind per project,
 * payments need a contract with something left to pay, the estimate locks with the main contract.
 * Contract and payment edit / delete follow `canChangeStatus` (same rule: manager and admins).
 */
export function v2ProjectActions(
  project: Pick<V2Project, 'status' | 'canEdit' | 'contracts' | 'estimate'>,
): V2ProjectActions {
  const cancelled = project.status === 'cancelled';
  const active = project.canEdit && !cancelled;
  const { intro, main } = project.contracts;
  const unpaid = (intro?.remaining.amount ?? 0) > 0 || (main?.remaining.amount ?? 0) > 0;
  return {
    canChangeStatus: active,
    canAddIntroContract: active && intro === null,
    canAddMainContract: active && main === null,
    canAddPayment: active && unpaid,
    canEditEstimate: active && !project.estimate.locked,
    canCancel: active,
    canRestore: project.canEdit && cancelled,
    canComment: !cancelled,
    lockReason: !project.canEdit ? 'viewer' : cancelled ? 'cancelled' : null,
  };
}

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
