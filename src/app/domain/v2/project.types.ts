import type {
  ProjectCancelReason,
  ProjectCurrency,
  ProjectEventType,
  ProjectStageDetails,
  ProjectStatus,
  ProjectType,
} from '@core/api/generated/kolss-api.types';

/**
 * CRM v2 project view models (owner boards of 2026-09-29, API 2.32.0). Screens take these, not
 * the raw API DTOs. Dates stay ISO strings (`YYYY-MM-DD` office-local dates, ISO timestamps);
 * the UI formats them with `date-format.ts`.
 */

export type V2ProjectStatus = ProjectStatus;
export type V2ProjectType = ProjectType;
export type V2ProjectCurrency = ProjectCurrency;
export type V2ProjectCancelReason = ProjectCancelReason;
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
  readonly number: string;
  readonly signedOn: string;
  readonly total: V2Money;
  readonly paid: V2Money;
  readonly remaining: V2Money;
  /** Whole percent of the total that is paid, 0–100. */
  readonly percentPaid: number;
  readonly fullyPaid: boolean;
  readonly file: V2ProjectFile | null;
}

export interface V2ProjectPayment {
  readonly id: string;
  readonly amount: V2Money;
  readonly paidOn: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly createdByName: string;
  readonly file: V2ProjectFile | null;
  /** Whole percent of the contract total this payment covers. */
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
  readonly createdAt: string;
  readonly createdByName: string;
  readonly statusChangedAt: string;
  readonly lastActivityAt: string;
  readonly cancellation: V2ProjectCancellation | null;
  readonly contract: V2ProjectContract | null;
  readonly payments: readonly V2ProjectPayment[];
  /** Server decision: the responsible manager and admins act, everyone else only views. */
  readonly canEdit: boolean;
}

export interface V2ProjectListItem {
  readonly id: string;
  readonly leadId: string;
  readonly code: string;
  readonly clientName: string;
  /** Product tags of the lead, e.g. `kitchen`. */
  readonly products: readonly string[];
  readonly status: V2ProjectStatus;
  readonly projectType: V2ProjectType | null;
  readonly schedule: V2ProjectSchedule | null;
  readonly manager: V2ProjectPerson | null;
  readonly createdAt: string;
  readonly lastComment: { readonly text: string; readonly at: string } | null;
}

/** Chip counts of the list: every status is present, missing API keys become 0. */
export interface V2ProjectFacets {
  readonly total: number;
  readonly status: Readonly<Record<V2ProjectStatus, number>>;
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
