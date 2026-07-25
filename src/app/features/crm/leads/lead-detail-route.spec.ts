import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '@core/auth/auth.service';
import { SessionService } from '@core/session/session.service';
import { LeadActivitiesService } from '@services/lead-activities.service';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { AppointmentsService } from '@services/appointments.service';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import { LeadDetailPage } from './lead-detail-route';

describe('LeadDetailPage route param binding', () => {
  async function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'leads/:leadId', component: LeadDetailPage }],
          withComponentInputBinding(),
        ),
        {
          provide: AuthService,
          useValue: {
            profile: () => ({ role: 'office_member' }),
            sessionContext: () => ({ user: { id: 'route-test-user' } }),
            me: () => ({
              permissions: {
                canManageUsers: false,
                canEditLeadFields: true,
                canArchiveLeads: false,
                canRestoreLeads: false,
              },
            }),
          },
        },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            officeContext: () => ({ isSuperAdmin: false, userOffices: [], filterOffices: [] }),
          },
        },
        { provide: LeadsService, useValue: { getById: async () => null } },
        { provide: LeadActivitiesService, useValue: {} },
        { provide: UsersService, useValue: { listManagers: async () => [] } },
        { provide: AppointmentsService, useValue: { list: async () => ({ items: [] }) } },
        { provide: UiDialogService, useValue: { open: vi.fn(), confirm: vi.fn() } },
      ],
    });
    return RouterTestingHarness.create();
  }

  it('updates leadId via input binding — not a stale snapshot — when navigating between two lead routes without recreating the component', async () => {
    const harness = await setup();

    const first = await harness.navigateByUrl('/leads/lead-a', LeadDetailPage);
    expect(first.leadId()).toBe('lead-a');

    // Angular reuses the LeadDetailPage instance for the same route config —
    // this is exactly the scenario where `route.snapshot.paramMap` goes stale.
    const second = await harness.navigateByUrl('/leads/lead-b', LeadDetailPage);
    expect(second).toBe(first);
    expect(second.leadId()).toBe('lead-b');
  });
});
