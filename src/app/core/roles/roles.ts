import type { UserRole } from '../../models/database';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Супер-адмін',
  curator: 'Куратор',
  office_admin: 'Адмін офісу',
  office_member: 'Менеджер',
};

export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  'curator',
  'office_admin',
  'office_member',
];

export function roleLabel(role: UserRole | string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role as UserRole] ?? role;
}

export function canManageUsers(role: string | null | undefined): boolean {
  return role === 'super_admin';
}

export function canEditLeads(role: string | null | undefined): boolean {
  return (
    role === 'super_admin' ||
    role === 'curator' ||
    role === 'office_admin' ||
    role === 'office_member'
  );
}

export function canArchiveLeads(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'office_admin';
}

export function hasOfficeLeadFilter(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'curator';
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'super_admin';
}
