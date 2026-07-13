import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { Session } from '@supabase/supabase-js';

import { KolssApiClient } from '../api/generated/kolss-api.client';
import type { MeResponse } from '../api/generated/kolss-api.types';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { ImpersonationService } from './impersonation.service';

function meResponse(overrides: Partial<MeResponse['user']> & { role?: string } = {}): MeResponse {
  return {
    user: {
      id: overrides.id ?? 'effective-user',
      email: overrides.email ?? 'manager@kolss.test',
    },
    profile: {
      id: overrides.id ?? 'effective-user',
      role: (overrides.role as MeResponse['profile']['role']) ?? 'office_member',
      display_name: 'Manager',
      is_active: true,
      deactivated_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    offices: [],
    userOffices: [],
    permissions: {
      canManageUsers: false,
      canEditLeadFields: false,
      canArchiveLeads: false,
      canRestoreLeads: false,
    },
  };
}

describe('AuthService impersonation', () => {
  let me: ReturnType<typeof vi.fn>;
  let clear: ReturnType<typeof vi.fn>;
  let isActive: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;
  let getSession: ReturnType<typeof vi.fn>;

  const session = {
    user: { id: 'admin-user', email: 'admin@kolss.test' },
    access_token: 'token',
  } as Session;

  beforeEach(() => {
    me = vi.fn();
    clear = vi.fn();
    isActive = vi.fn().mockReturnValue(false);
    signOut = vi.fn().mockResolvedValue({ error: null });
    getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide: KolssApiClient,
          useValue: { me },
        },
        {
          provide: ImpersonationService,
          useValue: {
            clear,
            isActive,
            targetUserId: () => null,
            start: vi.fn(),
            stop: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            isConfigured: () => true,
            getClient: () => ({
              auth: {
                getSession,
                signOut,
                signInWithPassword: vi.fn(),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
                refreshSession: vi.fn(),
              },
            }),
          },
        },
      ],
    });
  });

  it('uses effective /v1/me user in sessionContext', async () => {
    me.mockResolvedValue(meResponse({ id: 'manager-1', email: 'manager@kolss.test' }));
    const auth = TestBed.inject(AuthService);

    await auth.initialize();

    expect(auth.sessionContext()?.user.id).toBe('manager-1');
    expect(auth.sessionContext()?.user.email).toBe('manager@kolss.test');
  });

  it('clears impersonation on signOut', async () => {
    me.mockResolvedValue(meResponse());
    const auth = TestBed.inject(AuthService);
    await auth.initialize();

    await auth.signOut();

    expect(clear).toHaveBeenCalledOnce();
  });

  it('recovers from invalid_impersonation exactly once', async () => {
    isActive.mockReturnValue(true);
    const httpError = new HttpErrorResponse({
      status: 403,
      error: { code: 'invalid_impersonation', message: 'nope' },
    });
    me
      .mockRejectedValueOnce(new Error('Impersonation is not permitted', { cause: httpError }))
      .mockResolvedValueOnce(meResponse({ id: 'admin-user', role: 'super_admin' }));

    const auth = TestBed.inject(AuthService);
    await auth.initialize();

    expect(clear).toHaveBeenCalledOnce();
    expect(me).toHaveBeenCalledTimes(2);
    expect(auth.sessionContext()?.user.id).toBe('admin-user');
  });

  it('does not clear impersonation on other 403 codes', async () => {
    isActive.mockReturnValue(true);
    const httpError = new HttpErrorResponse({
      status: 403,
      error: { code: 'super_admin_required', message: 'forbidden' },
    });
    me.mockRejectedValueOnce(new Error('forbidden', { cause: httpError }));

    const auth = TestBed.inject(AuthService);
    await auth.initialize();

    expect(clear).not.toHaveBeenCalled();
    expect(auth.sessionContext()).toBeNull();
  });
});
