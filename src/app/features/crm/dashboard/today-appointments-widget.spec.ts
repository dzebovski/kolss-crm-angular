import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { AppointmentsService } from '../../../services/appointments.service';
import { TodayAppointmentsWidget } from './today-appointments-widget';

describe('TodayAppointmentsWidget', () => {
  it('requests and groups each accessible office when the global filter is all', async () => {
    const offices = [
      {
        id: 'office-kyiv',
        code: 'kyiv',
        name_uk: 'Київ',
        name_pl: 'Kijów',
        timezone_name: 'Europe/Kyiv',
        is_active: true,
      },
      {
        id: 'office-warsaw',
        code: 'warsaw',
        name_uk: 'Варшава',
        name_pl: 'Warszawa',
        timezone_name: 'Europe/Warsaw',
        is_active: true,
      },
    ];
    const list = vi.fn().mockImplementation(async ({ officeId }: { officeId: string }) => ({
      items: [
        {
          id: `appointment-${officeId}`,
          lead: { id: 'lead-1', name: 'Клієнт', phone: '+380500000000' },
          office: {
            id: officeId,
            code: officeId.endsWith('warsaw') ? 'warsaw' : 'kyiv',
            name: officeId.endsWith('warsaw') ? 'Варшава' : 'Київ',
            timezoneName: officeId.endsWith('warsaw') ? 'Europe/Warsaw' : 'Europe/Kyiv',
          },
          responsibleManager: { id: 'manager-1', displayName: 'Олена' },
          startsAt: '2026-07-23T09:00:00.000Z',
          endsAt: '2026-07-23T10:00:00.000Z',
          status: 'scheduled',
          comment: null,
          version: 1,
          hasConflict: false,
          isOutsideWorkingHours: false,
          warnings: [],
          createdAt: '2026-07-20T12:00:00.000Z',
          updatedAt: '2026-07-20T12:00:00.000Z',
        },
      ],
      timezone: 'UTC',
      from: '2026-07-23',
      to: '2026-07-24',
    }));
    await TestBed.configureTestingModule({
      imports: [TodayAppointmentsWidget],
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: {
            selectedOfficeId: () => null,
            officeContext: () => ({ filterOffices: offices }),
            locale: () => 'uk',
          },
        },
        { provide: AppointmentsService, useValue: { list } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TodayAppointmentsWidget);
    await fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: 'office-kyiv', status: 'scheduled' }),
    );
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: 'office-warsaw', status: 'scheduled' }),
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Київ');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Варшава');
  });
});
