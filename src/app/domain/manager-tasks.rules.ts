import type { CrmEmployee } from '@services/users.service';

export function dashboardManagers(
  managers: readonly CrmEmployee[],
  officeId: string | null,
  currentUserId: string | null,
  locale: string,
): readonly CrmEmployee[] {
  return managers
    .filter(
      (manager) =>
        manager.status === 'active' && (!officeId || manager.officeUuids.includes(officeId)),
    )
    .sort((left, right) => {
      if (left.id === currentUserId) return -1;
      if (right.id === currentUserId) return 1;
      return (
        left.displayName.localeCompare(right.displayName, locale) || left.id.localeCompare(right.id)
      );
    });
}
