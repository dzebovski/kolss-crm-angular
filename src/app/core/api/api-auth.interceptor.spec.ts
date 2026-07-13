import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ImpersonationService } from '../auth/impersonation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { apiAuthInterceptor } from './api-auth.interceptor';

describe('apiAuthInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let getSession: ReturnType<typeof vi.fn>;
  let refreshSession: ReturnType<typeof vi.fn>;
  let targetUserId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    });
    refreshSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'refreshed-token' } },
      error: null,
    });
    targetUserId = vi.fn().mockReturnValue('manager-99');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiAuthInterceptor])),
        provideHttpClientTesting(),
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              auth: { getSession, refreshSession },
            }),
          },
        },
        {
          provide: ImpersonationService,
          useValue: { targetUserId },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function flushAuth(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
  }

  it('adds Authorization and impersonation headers when active', async () => {
    const pending = firstValueFrom(http.get(`${environment.apiBaseUrl}/v1/me`));
    await flushAuth();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/v1/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(req.request.headers.get('X-Impersonate-User-Id')).toBe('manager-99');
    req.flush({ ok: true });

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('omits impersonation header when inactive', async () => {
    targetUserId.mockReturnValue(null);
    const pending = firstValueFrom(http.get(`${environment.apiBaseUrl}/v1/me`));
    await flushAuth();

    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/v1/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(req.request.headers.has('X-Impersonate-User-Id')).toBe(false);
    req.flush({ ok: true });

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('keeps impersonation header after token refresh retry', async () => {
    const pending = firstValueFrom(http.get(`${environment.apiBaseUrl}/v1/me`));
    await flushAuth();

    const first = httpTesting.expectOne(`${environment.apiBaseUrl}/v1/me`);
    first.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    await flushAuth();

    const retry = httpTesting.expectOne(`${environment.apiBaseUrl}/v1/me`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
    expect(retry.request.headers.get('X-Impersonate-User-Id')).toBe('manager-99');
    retry.flush({ ok: true });

    await expect(pending).resolves.toEqual({ ok: true });
    expect(refreshSession).toHaveBeenCalledOnce();
  });
});
