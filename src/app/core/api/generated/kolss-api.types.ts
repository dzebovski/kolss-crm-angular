import type { Office, Profile } from '@models/database';
import type {
  ContactAttemptRow,
  ContractRow,
  LeadEventRow,
  LeadListRow,
  ShowroomVisitRow,
} from '@services/leads.mapper';

export const API_CONTRACT_VERSION = '2.19.0' as const;

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
}

export interface ManagerTaskMutationResponse {
  readonly id: string;
  readonly version: number;
  readonly status: ManagerTaskStatus;
}
