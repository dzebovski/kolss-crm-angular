import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import { AuthService } from '../core/auth/auth.service';
import { AdminUsersService } from './admin-users.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('loads lead-assignment choices from the lightweight managers endpoint', async () => {
    const managers = vi.fn().mockResolvedValue({ items: [] });
    TestBed.configureTestingModule({
      providers: [
        UsersService,
        { provide: KolssApiClient, useValue: { managers } },
        { provide: AdminUsersService, useValue: {} },
        { provide: AuthService, useValue: {} },
      ],
    });

    const service = TestBed.inject(UsersService);

    await expect(service.listManagers()).resolves.toEqual([]);
    expect(managers).toHaveBeenCalledOnce();
  });
});
