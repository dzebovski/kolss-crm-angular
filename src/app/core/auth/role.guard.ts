import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { canManageUsers } from '@core/roles/roles';
import { AuthService } from './auth.service';
import { waitForAuthReady } from './auth.guard';

export function roleGuard(requiredCheck: (role: string | null | undefined) => boolean): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.initialized()) {
      await auth.initialize();
    }

    if (auth.loading()) {
      await waitForAuthReady(auth);
    }

    const role = auth.profile()?.role;
    if (!requiredCheck(role)) {
      return router.createUrlTree(['/crm/leads']);
    }

    return true;
  };
}

export const superAdminGuard = roleGuard(canManageUsers);
