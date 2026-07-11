import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SupabaseService } from '../supabase/supabase.service';

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiBaseUrl)) return next(request);

  const supabase = inject(SupabaseService).getClient();
  return from(supabase.auth.getSession()).pipe(
    switchMap(({ data, error }) => {
      if (error) throw error;
      const token = data.session?.access_token;
      const authenticatedRequest =
        token
          ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : request;
      return next(authenticatedRequest).pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
            return throwError(() => error);
          }
          return from(supabase.auth.refreshSession()).pipe(
            switchMap(({ data: refreshed, error: refreshError }) => {
              if (refreshError || !refreshed.session?.access_token) {
                return throwError(() => refreshError ?? error);
              }
              return next(
                request.clone({
                  setHeaders: { Authorization: `Bearer ${refreshed.session.access_token}` },
                }),
              );
            }),
          );
        }),
      );
    }),
  );
};
