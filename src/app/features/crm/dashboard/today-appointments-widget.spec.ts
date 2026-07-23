import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SessionService } from '../../../core/session/session.service';
import { AppointmentsService } from '../../../services/appointments.service';
import { UsersService } from '../../../services/users.service';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
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
    const list = vi.fn().mockImplementation(async ({ officeId }: { officeId: string }) => {
      const office = {
        id: officeId,
        code: officeId.endsWith('warsaw') ? 'warsaw' : 'kyiv',
        name: officeId.endsWith('warsaw') ? 'Варшава' : 'Київ',
        timezoneName: officeId.endsWith('warsaw') ? 'Europe/Warsaw' : 'Europe/Kyiv',
      };
      const appointment = {
        id: `appointment-${officeId}-scheduled`,
        lead: { id: 'lead-1', name: 'Запланований', phone: '+380500000000' },
        office,
        responsibleManager: { id: 'manager-1', displayName: 'Олена' },
        startsAt: '2026-07-23T09:00:00.000Z',
        endsAt: '2026-07-23T10:00:00.000Z',
        status: 'scheduled',
        comment: 'Підготувати документи для зустрічі',
        version: 1,
        hasConflict: false,
        isOutsideWorkingHours: false,
        warnings: [],
        createdAt: '2026-07-20T12:00:00.000Z',
        updatedAt: '2026-07-20T12:00:00.000Z',
      };
      return {
        items: [
          appointment,
          {
            ...appointment,
            id: `appointment-${officeId}-visited`,
            lead: { ...appointment.lead, id: 'lead-2', name: 'Відвіданий' },
            startsAt: '2026-07-23T10:00:00.000Z',
            endsAt: '2026-07-23T11:00:00.000Z',
            status: 'visited',
          },
          {
            ...appointment,
            id: `appointment-${officeId}-no-show`,
            lead: { ...appointment.lead, id: 'lead-3', name: 'Не прийшов клієнт' },
            startsAt: '2026-07-23T11:00:00.000Z',
            endsAt: '2026-07-23T12:00:00.000Z',
            status: 'no_show',
          },
          {
            ...appointment,
            id: `appointment-${officeId}-canceled`,
            lead: { ...appointment.lead, id: 'lead-4', name: 'Скасований' },
            startsAt: '2026-07-23T12:00:00.000Z',
            endsAt: '2026-07-23T13:00:00.000Z',
            status: 'canceled',
          },
          {
            ...appointment,
            id: `appointment-${officeId}-rescheduled`,
            lead: { ...appointment.lead, id: 'lead-5', name: 'Старий перенесений запис' },
            startsAt: '2026-07-23T13:00:00.000Z',
            endsAt: '2026-07-23T14:00:00.000Z',
            status: 'rescheduled',
          },
        ],
        timezone: 'UTC',
        from: '2026-07-23',
        to: '2026-07-24',
      };
    });
    const listManagers = vi.fn().mockResolvedValue([]);
    const open = vi.fn().mockReturnValue({ afterClosed: () => of(undefined) });
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
        { provide: UsersService, useValue: { listManagers } },
        { provide: UiDialogService, useValue: { open } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TodayAppointmentsWidget);
    await fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ officeId: 'office-kyiv' }));
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ officeId: 'office-warsaw' }));
    expect(list.mock.calls.every(([filters]) => filters.status === undefined)).toBe(true);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Київ');
    expect(element.textContent).toContain('Варшава');
    expect(element.textContent).toContain('Відвідав');
    expect(element.textContent).toContain('Не прийшов');
    expect(element.textContent).toContain('Скасовано');
    expect(element.querySelector('.appointment-comment')?.textContent).toContain(
      'Підготувати документи для зустрічі',
    );
    expect(element.textContent).not.toContain('Старий перенесений запис');
    expect(element.querySelectorAll('.appointment-row')).toHaveLength(8);

    element.querySelector<HTMLButtonElement>('.appointment-row')!.click();
    await fixture.whenStable();

    expect(listManagers).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          appointment: expect.objectContaining({ id: 'appointment-office-kyiv-scheduled' }),
          office: expect.objectContaining({ id: 'office-kyiv' }),
        }),
        position: { right: '0', top: '0' },
      }),
    );
  });
});
