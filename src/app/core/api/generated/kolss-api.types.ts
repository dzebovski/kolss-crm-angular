import type { Office, Profile } from '../../../models/database';
import type {
  ContactAttemptRow,
  ContractRow,
  LeadEventRow,
  LeadListRow,
  ShowroomVisitRow,
} from '../../../services/leads.mapper';

export const API_CONTRACT_VERSION = '2.6.0' as const;

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
    readonly canEditLeadFields: boolean;
    readonly canArchiveLeads: boolean;
    readonly canRestoreLeads: boolean;
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
export type AppointmentWarning = 'manager_overlap' | 'outside_working_hours';

export interface Appointment {
  readonly id: string;
  readonly lead: {
    readonly id: string;
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
