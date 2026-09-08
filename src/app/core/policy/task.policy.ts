import type { MeResponse } from '@core/api/generated/kolss-api.types';

/** Office authorization is enforced by the API; this capability gates task controls. */
export function canManageTasks(permissions: MeResponse['permissions'] | undefined): boolean {
  return permissions?.canManageTasks ?? false;
}
