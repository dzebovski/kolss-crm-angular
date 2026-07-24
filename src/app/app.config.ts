import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { NavigationError, provideRouter, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { apiAuthInterceptor } from './core/api/api-auth.interceptor';
import { clearChunkReloadGuard, tryReloadForStaleChunk } from './core/chunk-load-recovery';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withNavigationErrorHandler((error: NavigationError) => {
        tryReloadForStaleChunk(error.error ?? error);
      }),
    ),
    provideHttpClient(withFetch(), withInterceptors([apiAuthInterceptor])),
    provideAppInitializer(() => {
      clearChunkReloadGuard();
      return inject(AuthService).initialize();
    }),
  ],
};
