import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { AuthService } from '@core/auth/auth.service';
import { SessionService } from '@core/session/session.service';
import { UsersService } from '@services/users.service';
import { AppointmentsService } from '@services/appointments.service';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import { DashboardPage } from './dashboard-page';

const office = {
  id: 'office-kyiv',
  code: 'kyiv',
  name_uk: 'Київ',
  name_pl: 'Kijów',
  timezone_name: 'Europe/Kyiv',
  is_active: true,
};

function manager(id: string, displayName: string) {
  return {
    id,
    email: `${id}@test.local`,
    displayName,
    role: 'office_member' as const,
    officeIds: ['kyiv'] as const,
    officeUuids: ['office-kyiv'] as const,
    status: 'active' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: '2026-01-01T00:00:00.000Z',
  };
}

async function render(
  managers = [manager('other', 'Other Manager'), manager('current', 'Current User')],
) {
  await TestBed.configureTestingModule({
    imports: [DashboardPage],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          me: () => ({
            user: { id: 'current' },
            permissions: { canManageUsers: false, canManageTasks: true },
          }),
        },
      },
      {
        provide: SessionService,
        useValue: {
          selectedOfficeId: () => null,
          locale: () => 'uk',
          officeContext: () => ({ filterOffices: [office] }),
        },
      },
      { provide: UsersService, useValue: { listManagers: vi.fn().mockResolvedValue(managers) } },
      {
        provide: AppointmentsService,
        useValue: { list: vi.fn().mockResolvedValue({ items: [] }) },
      },
      { provide: UiDialogService, useValue: { open: vi.fn() } },
      {
        provide: KolssApiClient,
        useValue: { managerTasks: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(DashboardPage);
  await fixture.whenStable();
  return fixture;
}

describe('DashboardPage manager board', () => {
  it('puts the current user manager group first and marks it as You', async () => {
    const fixture = await render();
    const groups = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('details.manager-group'),
    ];
    expect(groups[0]?.textContent).toContain('Current User');
    expect(groups[0]?.textContent).toContain('Ви');
  });

  it('renders the empty manager state and an unassigned accordion', async () => {
    const fixture = await render([]);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('У цьому офісі немає активних менеджерів');
    expect(page.querySelector('details.manager-group.is-unassigned')).not.toBeNull();
  });

  it('keeps the unassigned accordion collapsed by default', async () => {
    const fixture = await render([]);
    const group = (fixture.nativeElement as HTMLElement).querySelector('details.is-unassigned')!;
    expect(group.hasAttribute('open')).toBe(false);
  });
});
