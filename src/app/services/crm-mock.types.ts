import type { UserRole } from '../models/database';

export type OfficeId = 'kyiv' | 'warsaw';
export type OfficeFilter = 'all' | OfficeId;
export type LocaleCode = 'uk' | 'pl' | 'en';
export type EmployeeStatus = 'active' | 'inactive';

export type LeadStatus = 'new' | 'in_progress' | 'converted' | 'failed';

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
  readonly lastActivityAt: string;
  readonly attachments: readonly LeadAttachment[];
  readonly events: readonly LeadEvent[];
}

export interface LeadMonthGroup {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly MockLead[];
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
