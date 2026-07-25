import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

import type { MeResponse } from '@core/api/generated/kolss-api.types';
import { AuthService } from './auth.service';
import { superAdminGuard } from './role.guard';

function meResponse(canManageUsers: boolean): MeResponse {
  return {
    user: { id: 'user-1' },
    profile: {
      id: 'user-1',
      role: canManageUsers ? 'super_admin' : 'office_member',
      display_name: null,
      is_active: true,
      deactivated_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    offices: [],
    userOffices: [],
    permissions: {
      canManageUsers,
      canEditLeadFields: false,
      canArchiveLeads: false,
      canRestoreLeads: false,
    },
  };
}

interface AuthServiceStub {
  readonly initialized: () => boolean;
  readonly loading: () => boolean;
  readonly me: () => MeResponse | null;
  readonly initialize?: () => Promise<void>;
}

describe('superAdminGuard', () => {
  const route = {} as unknown as ActivatedRouteSnapshot;
  const state = {} as unknown as RouterStateSnapshot;

  function setup(auth: AuthServiceStub) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  }

  it('allows a user whose /v1/me permissions grant canManageUsers', async () => {
    setup({
      initialized: () => true,
      loading: () => false,
      me: () => meResponse(true),
    });

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(route, state));

    expect(result).toBe(true);
  });

  it('redirects to /crm/leads when canManageUsers is false', async () => {
    setup({
      initialized: () => true,
      loading: () => false,
      me: () => meResponse(false),
    });

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(route, state));

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/crm/leads');
  });

  it('waits for auth.initialize() before checking, then denies if /v1/me never loaded', async () => {
    const initialize = vi.fn(async () => undefined);
    setup({
      initialized: () => false,
      loading: () => false,
      initialize,
      me: () => null,
    });

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(route, state));

    expect(initialize).toHaveBeenCalledOnce();
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('denies safely (does not fail open) when permissions are missing', async () => {
    setup({
      initialized: () => true,
      loading: () => false,
      me: () => null,
    });

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(route, state));

    expect(result).toBeInstanceOf(UrlTree);
  });
});
