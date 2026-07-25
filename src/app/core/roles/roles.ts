import type { UserRole } from '@models/database';

/**
 * Single source of truth for the four role literals; import these instead of
 * retyping them. Declared with `satisfies` (not `: UserRole`) so each constant
 * keeps its own literal type — callers like `ViewAsMode` (`typeof
 * ROLE_SUPER_ADMIN`) rely on that.
 */
export const ROLE_SUPER_ADMIN = 'super_admin' satisfies UserRole;
export const ROLE_CURATOR = 'curator' satisfies UserRole;
export const ROLE_OFFICE_ADMIN = 'office_admin' satisfies UserRole;
export const ROLE_OFFICE_MEMBER = 'office_member' satisfies UserRole;

/** Default role preselected in new-employee forms. */
export const DEFAULT_ROLE = ROLE_OFFICE_MEMBER satisfies UserRole;

export const ASSIGNABLE_ROLES: readonly UserRole[] = [
  ROLE_CURATOR,
  ROLE_OFFICE_ADMIN,
  ROLE_OFFICE_MEMBER,
];

export function hasOfficeLeadFilter(role: UserRole | null | undefined): boolean {
  return role === ROLE_SUPER_ADMIN || role === ROLE_CURATOR;
}

export function isSuperAdminRole(role: UserRole | null | undefined): boolean {
  return role === ROLE_SUPER_ADMIN;
}

/** Field managers assignable to appointments/leads — excludes curators, admins and super admins. */
export function isOfficeMemberRole(role: UserRole | null | undefined): boolean {
  return role === ROLE_OFFICE_MEMBER;
}
