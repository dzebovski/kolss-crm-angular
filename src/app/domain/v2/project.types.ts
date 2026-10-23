import type {
  ProjectCancelReason,
  ProjectContractKind,
  ProjectCurrency,
  ProjectEstimateLineKey,
  ProjectEventType,
  ProjectStageDetails,
  ProjectStatus,
  ProjectType,
} from '@core/api/generated/kolss-api.types';

/**
 * CRM v2 project view models (pipeline 2.1, API 2.36.0). Screens take these, not
 * the raw API DTOs. Dates stay ISO strings (`YYYY-MM-DD` office-local dates, ISO timestamps);
 * the UI formats them with `date-format.ts`.
 */

export type V2ProjectStatus = ProjectStatus;
export type V2ProjectType = ProjectType;
export type V2ProjectCurrency = ProjectCurrency;
export type V2ProjectCancelReason = ProjectCancelReason;
export type V2ProjectContractKind = ProjectContractKind;
export type V2EstimateLineKey = ProjectEstimateLineKey;
export type V2ProjectEventType = ProjectEventType;

/** An amount in major units (at most 2 decimals) with its currency. */
export interface V2Money {
  readonly amount: number;
  readonly currency: V2ProjectCurrency;
}

export interface V2ProjectPerson {
  readonly id: string;
  readonly name: string;
}

/** Download with `KolssApiClient.fileDownloadURL(id)`. */
export interface V2ProjectFile {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

/** The project's next event (deadline / visit / presentation …); the label comes from the status. */
export interface V2ProjectSchedule {
  /** `YYYY-MM-DD`, office-local. */
  readonly date: string;
  /** `HH:MM`, or null when the event has no time. */
  readonly time: string | null;
}

export interface V2ProjectContract {
  readonly id: string;
  readonly kind: V2ProjectContractKind;
  readonly number: string;
  readonly signedOn: string;
  readonly total: V2Money;
  /** Payments recorded on this contract. */
  readonly paid: V2Money;
  /** Main contract: the paid intro amount credited to it; zero for the intro contract. */
  readonly credited: V2Money;
  readonly remaining: V2Money;
  /** Main contract only: 50% of the total. A target shown on the card, never a gate. */
  readonly target50: V2Money | null;
  /** Whole percent of the total covered by payments and the credit, 0–100. */
  readonly percentPaid: number;
  readonly fullyPaid: boolean;
  /** Paid plus credited has reached the 50% target (always false without one). */
  readonly target50Reached: boolean;
  readonly file: V2ProjectFile | null;
}

export interface V2ProjectContracts {
  readonly intro: V2ProjectContract | null;
  readonly main: V2ProjectContract | null;
}

export interface V2EstimateLine {
  readonly money: V2Money;
  readonly note: string | null;
}

/** Four optional lines; `totals` is the sum per currency. Read-only once `locked`. */
export interface V2ProjectEstimate {
  readonly lines: Readonly<Record<V2EstimateLineKey, V2EstimateLine | null>>;
  readonly totals: readonly V2Money[];
  readonly locked: boolean;
}

export interface V2ProjectPayment {
  readonly id: string;
  readonly contractId: string;
  readonly contractKind: V2ProjectContractKind;
  readonly amount: V2Money;
  readonly paidOn: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly createdByName: string;
  readonly file: V2ProjectFile | null;
  /** Whole percent of its contract's total this payment covers. */
  readonly sharePercent: number;
}

export interface V2ProjectCancellation {
  readonly cancelledAt: string;
  readonly cancelledByName: string;
  readonly reasons: readonly V2ProjectCancelReason[];
  readonly comment: string | null;
  /** The status "Restore project" returns to; null for data without one. */
  readonly previousStatus: V2ProjectStatus | null;
}

/** Project card (`GET /v1/projects/{id}` and every mutation response). */
export interface V2Project {
  readonly id: string;
  readonly leadId: string;
  /** The client, when the project is linked to one. */
  readonly clientId: string | null;
  readonly officeId: string;
  /** Client code, e.g. `W0231`. */
  readonly code: string;
  readonly clientName: string;
  readonly client: {
    readonly phone: string | null;
    readonly email: string | null;
    readonly cityRegion: string | null;
  };
  readonly status: V2ProjectStatus;
  readonly projectType: V2ProjectType | null;
  readonly schedule: V2ProjectSchedule | null;
  readonly stageDetails: ProjectStageDetails;
  readonly manager: V2ProjectPerson | null;
  readonly designer: V2ProjectPerson | null;
  readonly createdAt: string;
  readonly createdByName: string;
  readonly statusChangedAt: string;
  readonly lastActivityAt: string;
  readonly cancellation: V2ProjectCancellation | null;
  readonly estimate: V2ProjectEstimate;
  /** The office's default intro amount to prefill; null where none is configured. */
  readonly introDefault: V2Money | null;
  readonly contracts: V2ProjectContracts;
  /** Payments of both contracts, oldest first. */
  readonly payments: readonly V2ProjectPayment[];
  /** Server decision: the responsible manager and admins act, everyone else only views. */
  readonly canEdit: boolean;
}

export interface V2ProjectListItem {
  readonly id: string;
  readonly leadId: string;
  readonly clientId: string | null;
  readonly code: string;
  readonly clientName: string;
  /** Product tags of the lead, e.g. `kitchen`. */
  readonly products: readonly string[];
  readonly status: V2ProjectStatus;
  readonly projectType: V2ProjectType | null;
  readonly schedule: V2ProjectSchedule | null;
  readonly manager: V2ProjectPerson | null;
  readonly designer: V2ProjectPerson | null;
  /** Estimate total per currency; empty when no line is set. */
  readonly estimateTotals: readonly V2Money[];
  readonly createdAt: string;
  readonly lastComment: { readonly text: string; readonly at: string } | null;
}

/** Chip counts of the list: every status is present, missing API keys become 0. */
export interface V2ProjectFacets {
  readonly total: number;
  readonly status: Readonly<Record<V2ProjectStatus, number>>;
}

export interface V2ProjectBoardColumn {
  readonly status: V2ProjectStatus;
  /** All matching projects in this status. */
  readonly count: number;
  readonly items: readonly V2ProjectListItem[];
  /** Pass to `list` with `status=<column>` for more cards; null when all are shown. */
  readonly nextCursor: string | null;
}

/** Kanban: all 12 statuses in pipeline order, `cancelled` last. */
export interface V2ProjectBoard {
  readonly total: number;
  readonly columns: readonly V2ProjectBoardColumn[];
}

/** One timeline entry; the payload keeps the API's free-form old / new values. */
export interface V2ProjectTimelineEntry {
  readonly id: string;
  readonly type: V2ProjectEventType;
  readonly actor: V2ProjectPerson | null;
  readonly oldValue: Readonly<Record<string, unknown>> | null;
  readonly newValue: Readonly<Record<string, unknown>> | null;
  readonly comment: string | null;
  readonly createdAt: string;
}
