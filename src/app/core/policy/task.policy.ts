import type { MeResponse } from '@core/api/generated/kolss-api.types';
import { ROLE_CURATOR, ROLE_OFFICE_ADMIN, ROLE_SUPER_ADMIN } from '@core/roles/roles';
import type { UserRole } from '@models/database';

/** Office authorization is enforced by the API; this capability gates task controls. */
export function canManageTasks(permissions: MeResponse['permissions'] | undefined): boolean {
  return permissions?.canManageTasks ?? false;
}

/** "All tasks" is for super admins, office admins and curators (owner decision 2026-09-29); the API enforces it too. */
export function canViewAllTasks(role: UserRole | null | undefined): boolean {
  return role === ROLE_SUPER_ADMIN || role === ROLE_OFFICE_ADMIN || role === ROLE_CURATOR;
}

/** Admins may delete any manual task they can edit (Q-T3); others only their own. */
export function isTaskAdmin(role: UserRole | null | undefined): boolean {
  return role === ROLE_SUPER_ADMIN || role === ROLE_OFFICE_ADMIN;
}
