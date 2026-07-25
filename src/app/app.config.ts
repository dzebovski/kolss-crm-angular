import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  NavigationError,
  provideRouter,
  withComponentInputBinding,
  withNavigationErrorHandler,
} from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { apiAuthInterceptor } from './core/api/api-auth.interceptor';
import { clearChunkReloadGuard, tryReloadForStaleChunk } from './core/chunk-load-recovery';
import { I18nService } from './core/i18n/i18n.service';
import { SessionService } from './core/session/session.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withNavigationErrorHandler((error: NavigationError) => {
        tryReloadForStaleChunk(error.error ?? error);
      }),
    ),
    provideHttpClient(withFetch(), withInterceptors([apiAuthInterceptor])),
    provideAppInitializer(() => {
      clearChunkReloadGuard();
      const i18n = inject(I18nService);
      const session = inject(SessionService);
      // Load the active locale's message bundle before first render so
      // I18nService.t() (synchronous, called from templates) never has to
      // fall back to '' on startup. Runs alongside auth init since neither
      // depends on the other for the first paint.
      return Promise.all([inject(AuthService).initialize(), i18n.ensureLoaded(session.locale())]);
    }),
  ],
};
