import { TestBed } from '@angular/core/testing';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { ImpersonationService } from '../core/impersonation/impersonation.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  function setup(invoke: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({ functions: { invoke } }),
          },
        },
        {
          provide: ImpersonationService,
          useValue: {
            superAdminAccessToken: () => null,
          },
        },
      ],
    });
    return TestBed.inject(AdminUsersService);
  }

  it('invokes admin-users edge function with list action', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { ok: true, users: [] },
      error: null,
    });

    const service = setup(invoke);
    const users = await service.listUsers();
    expect(users).toEqual([]);
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'list', active_only: true },
      headers: undefined,
    });
  });

  it('surfaces edge function error body from FunctionsHttpError', async () => {
    const response = new Response(JSON.stringify({ error: 'Email для підтвердження не збігається' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    });

    const service = setup(invoke);
    await expect(service.deactivateUser('user-id', 'wrong@example.com')).rejects.toThrow(
      'Email для підтвердження не збігається',
    );
  });
});
