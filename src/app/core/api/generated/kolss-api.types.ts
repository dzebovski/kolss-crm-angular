import type { Office, Profile } from '../../../models/database';
import type {
  ContactAttemptRow,
  ContractRow,
  LeadEventRow,
  LeadListRow,
  ShowroomVisitRow,
} from '../../../services/leads.mapper';

export const API_CONTRACT_VERSION = '2.3.0' as const;

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
