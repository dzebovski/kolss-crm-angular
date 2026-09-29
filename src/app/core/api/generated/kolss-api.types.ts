import type { Office, Profile } from '@models/database';
import type {
  ContactAttemptRow,
  ContractRow,
  LeadEventRow,
  LeadListRow,
  ShowroomVisitRow,
} from '@services/leads.mapper';

export const API_CONTRACT_VERSION = '2.33.0' as const;

/** CRM v2 lead rating (`leads.rating`, OpenAPI `LeadRating`, 2.20.0). */
export type LeadRating = 'cold' | 'medium' | 'hot';

/** CRM v2 lead channel (`leads.channel`, OpenAPI `LeadChannel`, 2.21.0). */
export type LeadChannel =
  'referral' | 'phone' | 'office' | 'website' | 'meta_ads' | 'google_ads' | 'other';

/** CRM v2 lead status (`leads.v2_status`, OpenAPI `V2LeadStatus`, 2.23.0). */
export type ApiV2LeadStatus =
  'new' | 'later' | 'noanswer' | 'success' | 'thinking' | 'invited' | 'lost' | 'project';

/** Lead products (`leads.products`, OpenAPI `LeadProduct`, 2.23.0). */
export type LeadProduct = 'kitchen' | 'wardrobe' | 'furniture' | 'bathroom' | 'hallway' | 'other';

/** v2 Lost reasons (`V2StatusActivityRequest.lossReason`, 2.24.0). */
export type V2LossReason =
  'bought_elsewhere' | 'out_of_budget' | 'not_relevant' | 'cant_reach_client' | 'other';

/**
 * Planned project type (`leads.project_type`, OpenAPI `ProjectType`, 2.28.0). "Fill lead info" /
 * "Create project" boards: express (paid express evaluation), measure (paid measurement and
 * project design), contract (contract signing).
 */
export type ProjectType = 'express' | 'measure' | 'contract';

/**
 * `GET /v1/loss-reasons` row (`public.loss_reasons`, OpenAPI `LossReason`). `is_v2` (2.29.0, task
 * W10, decision D12) gates whether the CRM v2 "Lost" popup may offer/accept this code —
 * data-driven so the list can grow without a deploy; not every row is a v1 code either.
 */
export interface LossReason {
  readonly code: string;
  readonly label_uk: string;
  readonly label_pl: string;
  /** Set for the codes of the CRM v2 Lost list. */
  readonly label_en: string | null;
  readonly is_v2: boolean;
}

/** `GET /v1/leads/facets` (2.24.0): chip counts; missing keys mean 0. */
export interface LeadFacetsResponse {
  readonly total: number;
  readonly v2Status: Readonly<Partial<Record<ApiV2LeadStatus, number>>>;
  readonly rating: Readonly<Partial<Record<LeadRating, number>>>;
}

/** `POST /v1/leads/{leadId}/activities` with `type: v2_status` (2.24.0). */
export interface V2StatusActivityRequest {
  readonly type: 'v2_status';
  readonly status: 'success' | 'later' | 'noanswer' | 'thinking' | 'invited' | 'lost';
  readonly comment?: string;
  /** later / noanswer / thinking / invited: required; success: optional; lost: not allowed. */
  readonly dueAt?: string;
  /** success only: one number or a range, e.g. `20 000 – 25 000`. */
  readonly estimatedBudgetText?: string;
  readonly estimatedBudgetCurrency?: MoneyCurrency;
  readonly cityRegion?: string;
  readonly products?: readonly LeadProduct[];
  readonly nextAction?: string;
  /** invited only, required: an active member of the lead's office. */
  readonly designerId?: string;
  /** lost only. Required unless `lossReasons` is sent instead (send exactly one of the two). */
  readonly lossReason?: V2LossReason;
  /**
   * lost only (2.29.0, task W10, decision D12): an alternative to `lossReason` for several
   * reasons; not allowed together with it. `minItems: 1`. Each code must be a
   * `public.loss_reasons` row with `is_v2 = true`. `comment` is required only when `'other'` is
   * among the reasons.
   */
  readonly lossReasons?: readonly string[];
}

/**
 * `PATCH /v1/leads/{leadId}/info` (2.25.0; extended 2.28.0, task W9), the "Lead info" popup /
 * "Fill lead info" / "Create project" boards. Omitted = unchanged; `''` clears a text or (W9)
 * `projectType`/`responsibleManagerId`, `[]` clears products and `null` clears the measurement
 * date.
 */
export interface UpdateLeadInfoRequest {
  /** One number or a range, e.g. `20 000 – 25 000`; `''` clears the budget. */
  readonly estimatedBudgetText?: string;
  readonly estimatedBudgetCurrency?: MoneyCurrency;
  readonly cityRegion?: string;
  readonly products?: readonly LeadProduct[];
  readonly materialFronts?: string;
  readonly materialWorktop?: string;
  readonly materialAppliances?: string;
  readonly expectedLeadTime?: string;
  /** ISO date-time. */
  readonly preferredMeasurementAt?: string | null;
  /** W9; reuses the W8 "Create lead" column. */
  readonly aboutClient?: string;
  /** W9; reuses the W8 "Create lead" column. */
  readonly referredBy?: string;
  /** W9 clarification checklist: approximate budget discussed. */
  readonly checklistBudget?: boolean;
  /** W9 clarification checklist: project location discussed. */
  readonly checklistLocation?: boolean;
  /** W9 clarification checklist: production and installation period discussed. */
  readonly checklistPeriod?: boolean;
  /** W9 clarification checklist: materials discussed. */
  readonly checklistMaterials?: boolean;
  /** W9 clarification checklist: product type discussed. */
  readonly checklistProduct?: boolean;
  /** W9; "Client is informed about the next steps". The popup shows it as required; the API never requires it. */
  readonly clientInformed?: boolean;
  /** W9; `''` clears it. Not accepted by the "Successful call" activity — info popup only. */
  readonly projectType?: ProjectType | '';
  /**
   * W9; `''` clears it. Must be an active, non-super_admin member of the lead's office (same rule
   * as `assignedToId`, task G4) — distinct from the lead's `assignedToId`.
   */
  readonly responsibleManagerId?: string;
}

/**
 * `POST /v1/leads` body. `channel`, `referredBy`, `products`, `estimatedBudgetText` and
 * `aboutClient` are CRM v2 "Create lead" popup fields (2.26.0), all optional; v1 keeps working
 * unchanged when they are omitted.
 */
export interface CreateLeadRequest {
  readonly officeId: string;
  readonly source: 'website' | 'facebook' | 'office' | 'other';
  readonly name: string;
  readonly phone: string;
  readonly email?: string | null;
  readonly cityRegion: string;
  readonly productInterest: string;
  readonly estimatedBudget?: number | null;
  readonly estimatedBudgetCurrency?: MoneyCurrency;
  readonly initialMessage: string;
  /** Lead source date/time in the selected office's local timezone, e.g. `2026-07-20T12:00`. */
  readonly sourceCreatedAtLocal: string;
  /** "other" is not accepted here; omitted defaults the channel from `source` as before. */
  readonly channel?: LeadChannel;
  readonly referredBy?: string;
  readonly products?: readonly LeadProduct[];
  /** One number or a range, e.g. `20 000 – 25 000`; its lower bound overrides `estimatedBudget`. */
  readonly estimatedBudgetText?: string;
  readonly aboutClient?: string;
}

/** `POST /v1/leads/{leadId}/activities` with `type: rating` (2.20.0). */
export interface RatingActivityRequest {
  readonly type: 'rating';
  readonly rating: LeadRating;
}

export type MoneyCurrency = 'UAH' | 'USD' | 'EUR' | 'PLN';

export type LeadReportCohort = 'activity' | 'calendar';

export interface LeadReportQuery {
  readonly officeId: string | null;
  readonly cohort?: LeadReportCohort;
  readonly from?: string | null;
  readonly to?: string | null;
  readonly callStatus?: string | null;
  readonly clientStatus?: string | null;
}

export interface SalesFunnelReportQuery {
  readonly officeId: string | null;
  readonly from: string;
  readonly to: string;
}

export interface SalesFunnelStage {
  readonly count: number;
  readonly percent: number;
}

export interface SalesFunnelReportResponse {
  readonly generatedAt: string;
  readonly period: {
    readonly from: string;
    readonly to: string;
  };
  readonly stages: {
    readonly leads: SalesFunnelStage;
    readonly calls: SalesFunnelStage;
    readonly reached: SalesFunnelStage;
    readonly notReached: SalesFunnelStage;
    readonly showroomInvited: SalesFunnelStage;
    readonly showroomVisited: SalesFunnelStage;
    readonly measurementScheduled: SalesFunnelStage;
    readonly measurementCompleted: SalesFunnelStage;
    readonly calculationStarted: SalesFunnelStage;
  };
  readonly potential: {
    readonly currency: 'EUR';
    readonly total: number;
  };
  readonly contractTotals: readonly {
    readonly currency: MoneyCurrency;
    readonly total: number;
  }[];
  readonly financialComparisons: readonly SalesFunnelFinancialComparison[];
}

export interface SalesFunnelFinancialComparison {
  readonly officeCode: 'kyiv' | 'warsaw';
  readonly currency: 'UAH' | 'PLN';
  readonly estimatedTotal: number;
  readonly actualTotal: number;
  readonly difference: number;
  readonly realizationPercent: number | null;
}

export interface CurrencyRateSet {
  readonly version: number;
  readonly effectiveFrom: string;
  readonly plnPerEur: number;
  readonly uahPerEur: number;
  readonly uahPerUsd: number;
}

export interface UpdateCurrencyRatesRequest {
  readonly plnPerEur: number;
  readonly uahPerEur: number;
  readonly uahPerUsd: number;
}

export interface ApiErrorResponse {
  readonly code: string;
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly requestId: string;
}

export interface MeResponse {
  readonly user: { readonly id: string; readonly email?: string };
  readonly profile: Profile;
  readonly offices: readonly Office[];
  readonly userOffices: readonly Office[];
  readonly permissions: {
    readonly canManageUsers: boolean;
    readonly canManageTasks: boolean;
    readonly canEditLeadFields: boolean;
    readonly canArchiveLeads: boolean;
    readonly canRestoreLeads: boolean;
    readonly canAskLeadQuestions: boolean;
    /**
     * Same office scope as `canEditLeadFields`; the actual gate is `PATCH /v1/leads/{leadId}`
     * (2.27.0, task G4). v1's "Assign manager" dialog does not read this flag — only CRM v2 UI
     * is meant to use it. Not consumed anywhere yet.
     */
    readonly canChangeLeadManager: boolean;
  };
}

export interface LeadListResponse {
  readonly items: readonly LeadListRow[];
  readonly nextCursor: string;
}

export interface LeadMarkerResponse {
  readonly kind: 'reviewed' | 'manager_aware';
  readonly actor_id: string;
  readonly actor_name: string;
  readonly marked_at: string;
}

export interface LeadDetailResponse {
  readonly lead: LeadListRow;
  readonly relations: {
    readonly contactAttempts: readonly ContactAttemptRow[];
    readonly showroomVisits: readonly ShowroomVisitRow[];
    readonly contracts: readonly ContractRow[];
    readonly events: readonly LeadEventRow[];
  };
}

export interface LeadEventTranslationResponse {
  readonly translation: string;
  readonly sourceLanguage: 'UK' | 'PL';
  readonly translatedAt: string;
}

export interface TextTranslationRequest {
  readonly text: string;
  readonly sourceLanguage?: 'UK' | 'PL' | 'EN';
  readonly targetLanguage: 'UK' | 'PL' | 'EN';
}

export interface TextTranslationResponse {
  readonly translation: string;
  readonly sourceLanguage?: 'UK' | 'PL' | 'EN';
  readonly targetLanguage: 'UK' | 'PL' | 'EN';
}

export interface AnswerLeadQuestionRequest {
  readonly answer: string;
}

export interface AnswerLeadQuestionResponse {
  readonly ok: boolean;
  readonly eventId: string;
  readonly leadId: string;
  readonly answer: {
    readonly text: string;
    readonly actor_id: string;
    readonly actor_name: string;
    readonly answered_at: string;
    readonly translations: Readonly<Partial<Record<'UK' | 'PL' | 'EN', string>>>;
  };
}

export interface UpdateLeadQuestionAnswerRequest {
  readonly answer: string;
}

export interface TranslateLeadQuestionAnswerRequest {
  readonly targetLanguage: 'UK' | 'PL' | 'EN';
}

export interface UpdateLeadQuestionAnswerResponse {
  readonly changedFields: readonly string[];
}

export interface TranslateLeadQuestionAnswerResponse {
  readonly translation: string;
  readonly targetLanguage: 'UK' | 'PL' | 'EN';
}

export interface UsersResponse {
  readonly items: readonly AdminUserRow[];
}

export interface AdminUserRow {
  readonly id: string;
  readonly email: string;
  readonly profile: Profile;
  readonly offices: readonly Office[];
}

export type AppointmentStatus = 'scheduled' | 'visited' | 'no_show' | 'canceled' | 'rescheduled';
export type AppointmentKind = 'showroom' | 'measurement' | 'office_work';
export type AppointmentWarning = 'manager_overlap' | 'outside_working_hours';

export interface Appointment {
  readonly id: string;
  readonly lead: {
    readonly id: string;
    readonly referenceId: string;
    readonly name: string;
    readonly phone: string;
  };
  readonly office: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly timezoneName: string;
  };
  readonly responsibleManager: {
    readonly id: string;
    readonly displayName: string;
  } | null;
  readonly kind: AppointmentKind;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: AppointmentStatus;
  readonly comment: string | null;
  readonly version: number;
  readonly hasConflict: boolean;
  readonly isOutsideWorkingHours: boolean;
  readonly warnings: readonly AppointmentWarning[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppointmentListResponse {
  readonly items: readonly Appointment[];
  readonly timezone: string;
  readonly from: string;
  readonly to: string;
}

export interface AppointmentMutationResponse {
  readonly appointment: Appointment;
  readonly warnings: readonly AppointmentWarning[];
}

export interface CreateAppointmentRequest {
  readonly leadId: string;
  readonly kind?: AppointmentKind;
  readonly startsAtLocal: string;
  readonly durationMinutes: number;
  readonly responsibleManagerId: string;
  readonly comment?: string;
}

export interface UpdateAppointmentRequest {
  readonly startsAtLocal?: string;
  readonly durationMinutes?: number;
  readonly responsibleManagerId?: string;
  readonly comment?: string;
  readonly status?: 'visited' | 'no_show' | 'canceled';
}

export type ManagerTaskSection = 'important' | 'current' | 'future' | 'done' | 'canceled';
export type ManagerTaskStatus = 'open' | 'done' | 'canceled';

export interface DashboardTask {
  readonly id: string;
  readonly sourceId: string;
  readonly source: 'manual' | 'reminder' | 'appointment' | 'lead';
  readonly kind: string;
  readonly title: string;
  readonly comment: string | null;
  readonly dueAt: string | null;
  readonly localDate: string | null;
  readonly office: {
    readonly id: string;
    readonly code: string;
    readonly nameUk: string;
    readonly namePl: string;
    readonly timezoneName: string;
  };
  readonly managerId: string | null;
  readonly leadId: string | null;
  readonly leadName: string | null;
  readonly phone: string | null;
  readonly status: ManagerTaskStatus;
  readonly version: number | null;
  readonly updatedAt: string;
}

export interface ManagerTaskQuery {
  readonly officeId: string | null;
  readonly managerId: string;
  readonly section: ManagerTaskSection;
  readonly cursor?: string | null;
}

export interface ManagerTaskListResponse {
  readonly items: readonly DashboardTask[];
  readonly nextCursor: string | null;
}

export interface CreateManagerTaskRequest {
  readonly officeId: string;
  readonly assigneeId: string;
  readonly title: string;
  readonly dueDate: string | null;
  /** Office-local `HH:MM`; needs `dueDate` (2.33.0). */
  readonly dueTime?: string | null;
  readonly note?: string | null;
  /** Puts the task on a task list; exclusive with `link` (2.33.0). */
  readonly listId?: string | null;
  /** Only `lead` is accepted for now; `project` and `client` are reserved (2.33.0). */
  readonly link?: TaskLinkRequest | null;
}

export interface TaskLinkRequest {
  readonly type: 'lead' | 'project' | 'client';
  readonly id: string;
}

/** `PATCH /v1/tasks/{taskId}` (2.33.0): partial, at least one field. */
export interface UpdateManagerTaskRequest {
  readonly status?: ManagerTaskStatus;
  /** Only an open task can be in progress. */
  readonly inProgress?: boolean;
  readonly assigneeId?: string;
  readonly title?: string;
  readonly note?: string | null;
  /** `null` clears the date and the time. */
  readonly dueDate?: string | null;
  /** `HH:MM`, needs a due date; `null` clears it. */
  readonly dueTime?: string | null;
}

export interface ManagerTaskMutationResponse {
  readonly id: string;
  readonly version: number;
  readonly status: ManagerTaskStatus;
  readonly inProgress?: boolean;
}

export type TaskFeedView = 'my_day' | 'upcoming' | 'all' | 'done' | 'list';
export type TaskFeedKind = 'call' | 'visit' | 'comment' | 'nonext' | 'list' | 'personal';

/** `GET /v1/tasks` query (2.33.0). */
export interface TaskFeedQuery {
  readonly view: TaskFeedView;
  /** Required for view `list`. */
  readonly listId?: string;
  /** Only for view `all`. */
  readonly assigneeId?: string;
  readonly officeId?: string;
  readonly kinds?: readonly TaskFeedKind[];
  readonly q?: string;
}

export interface TaskFeedLink {
  readonly type: 'lead' | 'project' | 'client';
  readonly id: string;
  readonly name: string | null;
  readonly code: string | null;
  readonly phone: string | null;
}

export interface TaskFeedList {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface TaskFeedItem {
  readonly id: string;
  readonly sourceId: string;
  readonly source: 'manual' | 'reminder' | 'appointment' | 'lead';
  readonly kind: TaskFeedKind;
  readonly subKind?: string;
  readonly title: string | null;
  readonly note: string | null;
  readonly status: 'open' | 'done';
  readonly inProgress: boolean;
  readonly dueDate: string | null;
  readonly dueTime: string | null;
  readonly dueAt: string | null;
  readonly overdueDays: number;
  readonly office: DashboardTask['office'];
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
  readonly createdById: string | null;
  readonly createdByName: string | null;
  readonly link: TaskFeedLink | null;
  readonly list: TaskFeedList | null;
  /** `If-Match` value for `updateManagerTask`; manual tasks only. */
  readonly version: number | null;
  readonly canManage: boolean;
  readonly canEdit: boolean;
  readonly updatedAt: string;
}

export interface TaskFeedResponse {
  readonly items: readonly TaskFeedItem[];
  /** True when more than 500 items matched and the rest were dropped. */
  readonly truncated: boolean;
}

/** `GET /v1/tasks/counts`: sidebar badges of the Tasks page. */
export interface TaskCounts {
  readonly myDay: number;
  readonly upcoming: number;
  /** Everyone's overdue items; null unless super admin or office admin. */
  readonly overdue: number | null;
}

export interface TaskListMember {
  readonly id: string;
  readonly displayName: string;
}

export interface TaskList {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly datesText: string | null;
  readonly ownerId: string | null;
  readonly ownerName: string | null;
  /** `#rrggbb`. */
  readonly color: string;
  readonly version: number;
  readonly taskCount: number;
  readonly doneCount: number;
  readonly overdueCount: number;
  readonly members: readonly TaskListMember[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateTaskListRequest {
  readonly name: string;
  readonly description?: string | null;
  readonly datesText?: string | null;
  readonly ownerId?: string;
  readonly color?: string;
}

export interface UpdateTaskListRequest {
  readonly name?: string;
  readonly description?: string | null;
  readonly datesText?: string | null;
  readonly ownerId?: string;
  readonly color?: string;
}

/** Add documents board file type tag (2.30.0, task W11). */
export type LeadDocumentTag = 'plan' | 'photo' | 'drawing' | 'estimate' | 'other';

/** Step 1 of a document upload: the file name decides the type (pdf, jpg, jpeg, png, heic, dwg). */
export interface CreateLeadDocumentUploadRequest {
  readonly fileName: string;
  /** At most 25 MB (26 214 400 bytes). */
  readonly sizeBytes: number;
}

/** Presigned direct-to-storage upload: send the bytes with `method`, `uploadUrl` and exactly `headers`. */
export interface LeadDocumentUpload {
  readonly attachmentId: string;
  readonly uploadUrl: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

/** Step 2: confirm the uploaded file; writes one `attachment` timeline event. */
export interface ConfirmLeadDocumentRequest {
  readonly attachmentId: string;
  readonly tag?: LeadDocumentTag | '';
  /** Optional timeline note, at most 1000 characters. */
  readonly note?: string;
}

/** A confirmed lead document; download with `createFileDownloadURL(id)`. */
export interface LeadDocument {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly tag: LeadDocumentTag | null;
  readonly uploadedBy: string;
  readonly uploadedByName: string;
  readonly createdAt: string;
}

/** Edit timeline entry board (2.31.0, task W12). */
export type LeadEventCorrectionType = 'success' | 'later' | 'noanswer' | 'thinking' | 'comment';

export interface LeadEventCorrectionRequest {
  /** New type; must differ from the current one. */
  readonly type?: LeadEventCorrectionType;
  /** Required when the type becomes later / noanswer / thinking. */
  readonly dueAt?: string;
  readonly comment?: string;
  /** Required; kept in the entry's edit history. */
  readonly reason: string;
}

export interface LeadEventCorrectionResponse {
  readonly ok: boolean;
  readonly version: number;
  /** True when the entry was the latest status entry and the lead's status followed. */
  readonly leadStatusChanged: boolean;
}

/**
 * CRM v2 projects (2.32.0, task P1). Lifecycle order: none → express → measure → design → contract
 * → production → installation → completed; `cancelled` is outside the order, `none` is
 * "Status not set". `contract` is set only by adding a contract, `cancelled` only by cancelling.
 */
export type ProjectStatus =
  | 'none'
  | 'express'
  | 'measure'
  | 'design'
  | 'contract'
  | 'production'
  | 'installation'
  | 'completed'
  | 'cancelled';

export type ProjectCancelReason =
  | 'chose_another_supplier'
  | 'price_too_high'
  | 'postponed_renovation'
  | 'disagreed_design'
  | 'not_relevant'
  | 'other';

export type ProjectCurrency = 'PLN' | 'UAH' | 'EUR' | 'USD';

export interface ProjectPerson {
  readonly id: string;
  readonly name: string;
}

/** Download with `fileDownloadURL(id)`. */
export interface ProjectFileRef {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

export interface ProjectContract {
  readonly id: string;
  readonly number: string;
  /** `YYYY-MM-DD`. */
  readonly signedOn: string;
  /** Major units, at most 2 decimals. */
  readonly totalAmount: number;
  readonly currency: ProjectCurrency;
  readonly paidAmount: number;
  readonly remainingAmount: number;
  readonly file: ProjectFileRef | null;
}

export interface ProjectPayment {
  readonly id: string;
  /** In the contract's currency. */
  readonly amount: number;
  readonly paidOn: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly createdByName: string;
  readonly file: ProjectFileRef | null;
}

/** Details kept per stage so editing one does not erase the other; dates live on the project. */
export interface ProjectStageDetails {
  readonly express?: {
    readonly responsibleId?: string;
    readonly what?: string;
    readonly done?: boolean;
    readonly result?: string;
  };
  readonly measure?: {
    readonly responsibleId?: string;
    readonly address?: string;
    readonly done?: boolean;
    readonly result?: string;
  };
}

export interface ProjectCancellation {
  readonly cancelledAt: string;
  readonly cancelledBy: string | null;
  readonly cancelledByName: string;
  readonly reasons: readonly ProjectCancelReason[];
  readonly comment: string | null;
  /** The status Restore returns to. */
  readonly statusBeforeCancel: string | null;
}

/** `GET /v1/projects/{projectId}` and every project mutation response. */
export interface Project {
  readonly id: string;
  readonly leadId: string;
  readonly officeId: string;
  /** The lead's reference id (client code). */
  readonly code: string;
  readonly status: ProjectStatus;
  readonly projectType: ProjectType | null;
  /** Next event of the current status, office-local date. */
  readonly eventDate: string | null;
  /** `HH:MM`. */
  readonly eventTime: string | null;
  readonly statusDetails: ProjectStageDetails;
  readonly manager: ProjectPerson | null;
  readonly client: {
    readonly name: string;
    readonly phone: string | null;
    readonly email: string | null;
    readonly cityRegion: string | null;
  };
  readonly createdAt: string;
  readonly createdByName: string;
  readonly statusChangedAt: string;
  readonly lastActivityAt: string;
  readonly cancellation: ProjectCancellation | null;
  readonly contract: ProjectContract | null;
  readonly payments: readonly ProjectPayment[];
  readonly permissions: {
    /** The responsible manager and admins can change the project; others can only view. */
    readonly canEdit: boolean;
  };
}

export interface ProjectListItem {
  readonly id: string;
  readonly leadId: string;
  readonly code: string;
  readonly clientName: string;
  /** Product tags of the lead. */
  readonly products: readonly string[];
  readonly status: ProjectStatus;
  readonly projectType: ProjectType | null;
  readonly eventDate: string | null;
  readonly eventTime: string | null;
  readonly manager: ProjectPerson | null;
  readonly createdAt: string;
  readonly lastComment: { readonly text: string; readonly at: string } | null;
}

export interface ProjectListResponse {
  readonly items: readonly ProjectListItem[];
  /** Empty when there is no next page. */
  readonly nextCursor: string;
}

/** `GET /v1/projects` filters; `status` is sent comma-separated. */
export interface ProjectListQuery {
  /** Matches the client name, phone or code. */
  readonly q?: string;
  readonly managerId?: string;
  readonly officeId?: string;
  readonly status?: readonly ProjectStatus[];
  /** 1–100, default 30. */
  readonly limit?: number;
  readonly cursor?: string;
}

/** `GET /v1/projects/facets`: `total` with every filter, `status` counts without the status filter. */
export interface ProjectFacetsResponse {
  readonly total: number;
  /** Statuses without projects are absent. */
  readonly status: Readonly<Partial<Record<ProjectStatus, number>>>;
}

export type ProjectEventType =
  | 'created'
  | 'status_changed'
  | 'status_updated'
  | 'contract_added'
  | 'payment_added'
  | 'cancelled'
  | 'restored';

export interface ProjectEvent {
  readonly id: string;
  readonly type: ProjectEventType;
  readonly actor: ProjectPerson | null;
  readonly oldValue: Readonly<Record<string, unknown>> | null;
  readonly newValue: Readonly<Record<string, unknown>> | null;
  readonly comment: string | null;
  readonly createdAt: string;
}

/** `POST /v1/leads/{leadId}/project`: send `{}` to take everything from the lead. */
export interface CreateProjectRequest {
  readonly projectType?: ProjectType | null;
  /** Must be an active member of the lead's office. */
  readonly managerId?: string | null;
}

/** `POST /v1/projects/{projectId}/status`; required fields depend on the status. */
export interface ChangeProjectStatusRequest {
  readonly status: ProjectStatus;
  readonly eventDate?: string | null;
  /** `HH:MM`. */
  readonly eventTime?: string | null;
  readonly responsibleId?: string | null;
  readonly what?: string | null;
  readonly address?: string | null;
  readonly done?: boolean | null;
  readonly result?: string | null;
  /** Optional, goes to the timeline. */
  readonly comment?: string | null;
}

export interface CancelProjectRequest {
  /** At least one. */
  readonly reasons: readonly ProjectCancelReason[];
  /** Required when `other` is picked. */
  readonly comment?: string | null;
  readonly cancelFutureEvents?: boolean;
}

export interface AddProjectContractRequest {
  readonly number: string;
  readonly signedOn: string;
  /** Major units, at most 2 decimals. */
  readonly totalAmount: number;
  readonly currency: ProjectCurrency;
  /** The id from `createProjectFileUpload` with kind `contract`, uploaded before this call. */
  readonly fileId?: string | null;
}

export interface AddProjectPaymentRequest {
  /** Major units, at most 2 decimals; never above the remaining balance. */
  readonly amount: number;
  readonly paidOn: string;
  readonly note?: string | null;
  /** A receipt uploaded with kind `receipt`. */
  readonly fileId?: string | null;
}

export type ProjectFileKind = 'contract' | 'receipt';

export interface CreateProjectFileUploadRequest {
  readonly kind: ProjectFileKind;
  readonly fileName: string;
  /** 1 – 26 214 400 bytes (25 MB); PDF, JPG, PNG or HEIC. */
  readonly sizeBytes: number;
}

/** Presigned direct upload; pass `fileId` to `addProjectContract` / `addProjectPayment`. */
export interface ProjectFileUpload {
  readonly fileId: string;
  readonly uploadUrl: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}
