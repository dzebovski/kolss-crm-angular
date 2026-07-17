export type UserRole =
  | 'super_admin'
  | 'curator'
  | 'office_admin'
  | 'office_member';

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Office {
  id: string;
  code: string;
  name_uk: string;
  name_pl: string;
  is_active: boolean;
}

export interface UserOfficeMembership {
  user_id: string;
  office_id: string;
  offices?: Office;
}

export interface SessionUser {
  id: string;
  email?: string;
}

export interface SessionContext {
  user: SessionUser;
  profile: Profile;
}

export interface UserOfficeContext {
  isSuperAdmin: boolean;
  canFilter: boolean;
  offices: Office[];
  userOffices: Office[];
  filterOffices: Office[];
  canUseOfficeFilter: boolean;
}

export type ViewAsMode = 'super_admin' | 'kyiv' | 'warsaw';

export interface LeadStatus {
  code: string;
  label_uk: string;
  label_pl: string;
  sort_order: number;
  is_terminal: boolean;
}

export interface Lead {
  id: string;
  office_id: string;
  source_system: string;
  external_lead_id: string;
  lead_status: string;
  lead_status_changed_at: string | null;
  workflow_status: string;
  workflow_status_changed_at: string | null;
  call_status: string | null;
  call_status_changed_at: string | null;
  client_status: string;
  client_status_changed_at: string;
  assigned_to: string | null;
  loss_reason: string | null;
  converted_project_id: string | null;
  estimated_budget: number | null;
  our_quote: number | null;
  callback_due_at: string | null;
  source_channel: string | null;
  source_note: string | null;
  next_task_due_at: string | null;
  next_task_title: string | null;
  last_comment: string | null;
  last_comment_at: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_interest: string | null;
  order_comment: string | null;
  city_region: string | null;
  project_stage_source: string | null;
  source_created_at: string | null;
  created_at: string;
  updated_at: string;
  version?: number;
  archived_at?: string | null;
  archived_by?: string | null;
  offices?: Office;
  profiles?: { display_name: string | null };
}

export interface Project {
  id: string;
  lead_id: string;
  office_id: string;
  status: string;
  status_changed_at: string;
  last_activity_at: string;
  product_type: string | null;
  estimated_budget: number | null;
  our_quote: number | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}
