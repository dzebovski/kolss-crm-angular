import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ImpersonationService } from '../auth/impersonation.service';
import { SupabaseService } from '../supabase/supabase.service';

const IMPERSONATE_HEADER = 'X-Impersonate-User-Id';

function withAuthHeaders(
  request: HttpRequest<unknown>,
  token: string | undefined,
  impersonateUserId: string | null,
): HttpRequest<unknown> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (impersonateUserId) {
    headers[IMPERSONATE_HEADER] = impersonateUserId;
  }
  return Object.keys(headers).length > 0 ? request.clone({ setHeaders: headers }) : request;
}

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiBaseUrl)) return next(request);

  const supabase = inject(SupabaseService).getClient();
  const impersonation = inject(ImpersonationService);

  return from(supabase.auth.getSession()).pipe(
    switchMap(({ data, error }) => {
      if (error) throw error;
      const impersonateUserId = impersonation.targetUserId();
      const authenticatedRequest = withAuthHeaders(
        request,
        data.session?.access_token,
        impersonateUserId,
      );
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
                withAuthHeaders(
                  request,
                  refreshed.session.access_token,
                  impersonation.targetUserId(),
                ),
              );
            }),
          );
        }),
      );
    }),
  );
};
