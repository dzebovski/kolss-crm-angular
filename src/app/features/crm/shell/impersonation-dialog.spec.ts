import { TestBed } from '@angular/core/testing';

import { UsersService } from '../../../services/users.service';
import { ImpersonationDialog } from './impersonation-dialog';

describe('ImpersonationDialog', () => {
  const managers = [
    {
      id: 'mgr-1',
      email: 'a@test',
      displayName: 'Anna',
      role: 'office_member' as const,
      officeIds: ['kyiv' as const],
      officeUuids: ['office-kyiv'],
      status: 'active' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpersonationDialog],
      providers: [
        {
          provide: UsersService,
          useValue: {
            listManagers: vi.fn().mockResolvedValue(managers),
          },
        },
      ],
    }).compileComponents();
  });

  it('loads managers from /v1/managers facade', async () => {
    const users = TestBed.inject(UsersService);
    const fixture = TestBed.createComponent(ImpersonationDialog);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(users.listManagers).toHaveBeenCalledOnce();
    expect(fixture.componentInstance['managerOptions']().some((option) => option.value === 'mgr-1')).toBe(
      true,
    );
  });

  it('emits selected manager id on confirm', async () => {
    const fixture = TestBed.createComponent(ImpersonationDialog);
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['managerId'].set('mgr-1');
    fixture.componentInstance['confirm']();

    expect(selected).toHaveBeenCalledWith('mgr-1');
  });
});
