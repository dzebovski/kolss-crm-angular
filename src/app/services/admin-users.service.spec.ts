import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  function setup(api: Partial<KolssApiClient>) {
    TestBed.configureTestingModule({
      providers: [
        AdminUsersService,
        { provide: KolssApiClient, useValue: api },
      ],
    });
    return TestBed.inject(AdminUsersService);
  }

  it('loads active users through Go API', async () => {
    const users = vi.fn().mockResolvedValue({ items: [] });
    const service = setup({ users } as Partial<KolssApiClient>);

    await expect(service.listUsers()).resolves.toEqual([]);
    expect(users).toHaveBeenCalledWith(true);
  });

  it('sends exact confirmation email on deactivate', async () => {
    const userAction = vi.fn().mockResolvedValue(undefined);
    const service = setup({ userAction } as Partial<KolssApiClient>);

    await service.deactivateUser('user-id', 'user@example.com');
    expect(userAction).toHaveBeenCalledWith('user-id', 'deactivate', {
      confirmEmail: 'user@example.com',
    });
  });
});
