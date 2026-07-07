import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { canManageUsers } from '../roles/roles';
import { AuthService } from './auth.service';

export function roleGuard(requiredCheck: (role: string | null | undefined) => boolean): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.initialized()) {
      await auth.initialize();
    }

    const role = auth.profile()?.role;
    if (!requiredCheck(role)) {
      return router.createUrlTree(['/crm/dashboard']);
    }

    return true;
  };
}

export const superAdminGuard = roleGuard(canManageUsers);
