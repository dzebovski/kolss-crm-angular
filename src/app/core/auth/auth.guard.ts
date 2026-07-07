import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { SessionService } from '../session/session.service';
import { safeCrmReturnTo } from '../navigation/safe-return-to';

export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const session = inject(SessionService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await auth.initialize();
  }

  if (auth.loading()) {
    await waitForAuthReady(auth);
  }

  if (!auth.isAuthenticated() || !auth.profile()?.is_active) {
    return router.createUrlTree(['/login'], {
      queryParams: { next: state.url },
    });
  }

  if (!session.loaded()) {
    try {
      await session.loadOfficeContext();
    } catch {
      return router.createUrlTree(['/login'], {
        queryParams: { error: 'session', next: state.url },
      });
    }
  }

  return true;
};

export const guestGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.initialized()) {
    await auth.initialize();
  }

  if (auth.loading()) {
    await waitForAuthReady(auth);
  }

  if (auth.isAuthenticated() && auth.profile()?.is_active) {
    const next = safeCrmReturnTo(route.queryParamMap.get('next'));
    return router.parseUrl(next);
  }

  return true;
};

function waitForAuthReady(auth: AuthService): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!auth.loading()) {
        clearInterval(interval);
        resolve();
      }
    }, 16);
  });
}
