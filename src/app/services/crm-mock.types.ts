import type { UserRole } from '../models/database';

export type OfficeId = 'kyiv' | 'warsaw';
export type OfficeFilter = 'all' | OfficeId;
export type LocaleCode = 'uk' | 'pl' | 'en';
export type EmployeeStatus = 'active' | 'inactive';

export type LeadStatus = 'new' | 'in_progress' | 'converted' | 'failed';

export type CallStatus = 'reached' | 'no_answer' | 'callback_requested';

export type ClientStatus =
  | 'new_lead'
  | 'showroom_invited'
  | 'calculation_in_progress'
  | 'thinking'
  | 'closed_lost'
  | 'contract_signed';

export type LeadEventCategory = 'call_status' | 'client_status' | 'comment' | 'system';

export type LeadWorkflowStatus =
  | 'new'
  | 'taken'
  | 'callback_required'
  | 'first_call_done'
  | 'visit_scheduled'
  | 'visit_rescheduled'
  | 'visit_completed'
  | 'thinking'
  | 'closed'
  | 'successful';

export type LeadSource = 'website' | 'facebook' | 'office' | 'other';
export type LeadMarkerKind = 'reviewed' | 'manager_aware';

export interface LeadMarker {
  readonly kind: LeadMarkerKind;
  readonly actorId: string;
  readonly actorName: string;
  readonly markedAt: string;
}
export type VisitStatus = 'scheduled' | 'rescheduled' | 'completed';
export type LeadEventType =
  | 'created'
  | 'taken'
  | 'first_call'
  | 'visit_scheduled'
  | 'visit_rescheduled'
  | 'visit_completed'
  | 'comment'
  | 'thinking'
  | 'activated'
  | 'reopened'
  | 'closed'
  | 'successful'
  | 'call_status_changed'
  | 'client_status_changed'
  | 'comment_added'
  | 'lead_reopened'
  | 'attachment'
  | 'lead_updated';

/** `loss_reasons.code` from Supabase; mock labels cover CRM defaults. */
export type CloseReason = string;

export interface CrmOffice {
  readonly id: OfficeId;
  readonly code: OfficeId;
  readonly nameUk: string;
  readonly namePl: string;
}

export interface MockEmployee {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: UserRole;
  readonly officeIds: readonly OfficeId[];
  readonly status: EmployeeStatus;
  readonly locale: LocaleCode;
  readonly createdAt: string;
  readonly lastActiveAt: string;
}

export interface LeadAttachment {
  readonly id: string;
  readonly name: string;
  readonly sizeLabel: string;
  readonly addedAt: string;
  readonly eventId?: string;
}

export interface LeadEvent {
  readonly id: string;
  readonly type: LeadEventType;
  readonly rawType: string;
  readonly comment: string | null;
  readonly newValue: unknown;
  readonly actorId: string;
  /** Display name from API `profiles.display_name` join; empty when missing. */
  readonly actorName?: string;
  readonly occurredAt: string;
  readonly category?: LeadEventCategory | null;
  readonly statusCode?: string | null;
  readonly editAudit?: LeadEventEditAudit | null;
}

export interface LeadEventEditAudit {
  readonly fields: readonly string[];
  readonly editedAt: string;
  readonly editedById: string;
  readonly editedByName: string;
}

export interface FirstCall {
  readonly date: string;
  readonly result: string;
  readonly comment: string;
}

export interface ShowroomVisit {
  readonly status: VisitStatus;
  readonly scheduledAt: string;
  readonly completedAt?: string;
  readonly comment?: string;
}

export type ContractCurrency = 'UAH' | 'USD' | 'EUR' | 'PLN';

export interface LeadContract {
  readonly contractNumber: string;
  readonly amount: number;
  readonly currency: ContractCurrency;
  readonly comment: string;
  readonly signedAt: string;
}

export interface LeadClose {
  readonly reason: CloseReason;
  readonly comment: string;
  readonly closedAt: string;
  readonly actorId: string;
}

export interface MockLead {
  readonly id: string;
  readonly version?: number;
  readonly archivedAt?: string | null;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly leadStatus: LeadStatus;
  readonly workflowStatus: LeadWorkflowStatus;
  readonly callStatus: CallStatus | null;
  readonly callStatusChangedAt: string | null;
  readonly clientStatus: ClientStatus;
  readonly clientStatusChangedAt: string;
  readonly officeCode: OfficeId;
  readonly source: LeadSource;
  readonly sourceCreatedAt: string;
  readonly reactivatedAt?: string | null;
  readonly initialMessage: string;
  readonly cityRegion: string;
  readonly productInterest: string;
  readonly estimatedBudget: number | null;
  readonly assignedToId: string | null;
  readonly firstManagerId: string | null;
  readonly firstCall: FirstCall | null;
  readonly visit: ShowroomVisit | null;
  readonly close: LeadClose | null;
  readonly contract: LeadContract | null;
  readonly callbackDueAt: string | null;
  readonly lastComment: string | null;
  readonly latestTimelineComment: LatestTimelineComment | null;
  readonly lastActivityAt: string;
  readonly attachments: readonly LeadAttachment[];
  readonly events: readonly LeadEvent[];
  readonly markers: readonly LeadMarker[];
}

export interface LatestTimelineComment {
  readonly comment: string;
  readonly occurredAt: string;
  readonly eventType: string;
  readonly category: LeadEventCategory | null;
  readonly statusCode: string | null;
  readonly newValue: unknown;
}

export interface ContractCurrencyTotal {
  readonly currency: ContractCurrency;
  readonly total: number;
}

export interface LeadMonthGroup {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly MockLead[];
  readonly contractTotals: readonly ContractCurrencyTotal[];
}

export interface LeadYearGroup {
  readonly year: number;
  readonly months: readonly LeadMonthGroup[];
}

export interface FunnelStage {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly percentOfTotal: number;
  readonly conversionFromPrevious: number;
  readonly conversionBaseLabel: string | null;
  readonly tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';
}

export interface ManagerTakenRow {
  readonly managerId: string;
  readonly managerName: string;
  readonly takenCount: number;
}

export interface ManagerOfficeReport {
  readonly officeCode: OfficeId;
  readonly officeLabel: string;
  readonly managers: readonly ManagerTakenRow[];
  readonly unassignedCount: number;
}

export interface CloseLeadPayload {
  readonly reason: CloseReason;
  readonly comment: string;
}

export interface SuccessfulLeadPayload {
  readonly contractNumber: string;
  readonly amount: number;
  readonly currency: ContractCurrency;
  readonly comment: string;
}

export type LeadActivityPayload =
  | {
      readonly type: 'call_status';
      readonly status: CallStatus;
      readonly comment?: string;
    }
  | {
      readonly type: 'client_status';
      readonly status: Exclude<ClientStatus, 'new_lead'>;
      readonly reason?: 'expensive' | 'invalid' | 'other';
      readonly comment?: string;
      readonly contractNumber?: string;
      readonly amount?: number;
      readonly currency?: ContractCurrency;
    }
  | { readonly type: 'comment'; readonly comment: string }
  | { readonly type: 'reopen' };
