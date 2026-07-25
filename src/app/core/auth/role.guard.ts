import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import type { MeResponse } from '@core/api/generated/kolss-api.types';
import { AuthService } from './auth.service';
import { waitForAuthReady } from './auth.guard';

/**
 * Gates a route on a server-issued `/v1/me` capability rather than a
 * client-side role predicate. `AuthService.initialize()` (run by the app
 * initializer, and awaited below if it hasn't finished) always resolves
 * `me()` — successfully or not — before it flips `loading()` to false, so by
 * the time `requiredCheck` runs, `me()` reflects the latest fetch attempt.
 *
 * Known risk: if `initialize()` is already in flight (kicked off by the app
 * initializer) when this guard runs, `!auth.initialized()` is still true and
 * this guard calls `initialize()` a second time, firing a second `/v1/me`
 * request concurrently. That race predates this guard (the previous
 * role-based version had the exact same shape) and is out of scope here.
 * The safe fallback for every failure mode — `me()` still null, permissions
 * missing, the second fetch erroring — is the same as before: deny access
 * and redirect, never fail open.
 */
export function permissionGuard(requiredCheck: (me: MeResponse | null) => boolean): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.initialized()) {
      await auth.initialize();
    }

    if (auth.loading()) {
      await waitForAuthReady(auth);
    }

    if (!requiredCheck(auth.me())) {
      return router.createUrlTree(['/crm/leads']);
    }

    return true;
  };
}

export const superAdminGuard = permissionGuard((me) => me?.permissions.canManageUsers ?? false);
