import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import axe from 'axe-core';
import { of } from 'rxjs';

import type { Appointment } from '../../../core/api/generated/kolss-api.types';
import { SessionService } from '../../../core/session/session.service';
import { AppointmentsService } from '../../../services/appointments.service';
import { UsersService } from '../../../services/users.service';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { CalendarPage } from './calendar-page';

const office = {
  id: 'office-kyiv',
  code: 'kyiv',
  name_uk: 'Київ',
  name_pl: 'Kijów',
  timezone_name: 'Europe/Kyiv',
  is_active: true,
};

const warsawOffice = {
  id: 'office-warsaw',
  code: 'warsaw',
  name_uk: 'Варшава',
  name_pl: 'Warszawa',
  timezone_name: 'Europe/Warsaw',
  is_active: true,
};

const manager = {
  id: 'manager-1',
  email: null,
  displayName: 'Олена',
  role: 'office_member' as const,
  officeIds: ['kyiv'] as const,
  officeUuids: ['office-kyiv'],
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00Z',
  lastActiveAt: '2026-07-23T00:00:00Z',
};

const appointment: Appointment = {
  id: 'appointment-1',
  lead: { id: 'lead-1', name: 'Анна Коваль', phone: '+380501112233' },
  office: {
    id: office.id,
    code: office.code,
    name: office.name_uk,
    timezoneName: office.timezone_name,
  },
  responsibleManager: { id: manager.id, displayName: manager.displayName },
  startsAt: '2026-07-23T07:00:00.000Z',
  endsAt: '2026-07-23T08:00:00.000Z',
  status: 'scheduled',
  comment: 'Підготувати документи для зустрічі',
  version: 1,
  hasConflict: false,
  isOutsideWorkingHours: false,
  warnings: [],
  createdAt: '2026-07-20T12:00:00.000Z',
  updatedAt: '2026-07-20T12:00:00.000Z',
};

const visitedAppointment: Appointment = {
  ...appointment,
  id: 'appointment-visited',
  lead: { id: 'lead-visited', name: 'Ірина Бондар', phone: '+380501112244' },
  startsAt: '2026-07-23T08:00:00.000Z',
  endsAt: '2026-07-23T09:00:00.000Z',
  status: 'visited',
  version: 2,
};

const noShowAppointment: Appointment = {
  ...appointment,
  id: 'appointment-no-show',
  lead: { id: 'lead-no-show', name: 'Максим Левченко', phone: '+380501112255' },
  startsAt: '2026-07-23T09:00:00.000Z',
  endsAt: '2026-07-23T10:00:00.000Z',
  status: 'no_show',
  version: 2,
};

const canceledAppointment: Appointment = {
  ...appointment,
  id: 'appointment-canceled',
  lead: { id: 'lead-canceled', name: 'Олена Савчук', phone: '+380501112266' },
  startsAt: '2026-07-23T10:00:00.000Z',
  endsAt: '2026-07-23T11:00:00.000Z',
  status: 'canceled',
  version: 2,
};

const rescheduledAppointment: Appointment = {
  ...appointment,
  id: 'appointment-rescheduled',
  lead: { id: 'lead-rescheduled', name: 'Старий запис', phone: '+380501112277' },
  startsAt: '2026-07-23T11:00:00.000Z',
  endsAt: '2026-07-23T12:00:00.000Z',
  status: 'rescheduled',
  version: 2,
};

describe('CalendarPage', () => {
  async function render(queryParams: Record<string, string> = {}) {
    TestBed.resetTestingModule();
    const selectedOfficeId = signal<string | null>(office.id);
    const list = vi.fn().mockResolvedValue({
      items: [
        appointment,
        visitedAppointment,
        noShowAppointment,
        canceledAppointment,
        rescheduledAppointment,
      ],
      timezone: office.timezone_name,
      from: '2026-07-20',
      to: '2026-07-27',
    });
    const open = vi.fn().mockReturnValue({ afterClosed: () => of(undefined) });
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [CalendarPage],
      providers: [
        {
          provide: SessionService,
          useValue: {
            selectedOfficeId,
            officeContext: () => ({ filterOffices: [office, warsawOffice] }),
            locale: () => 'uk',
          },
        },
        { provide: AppointmentsService, useValue: { list } },
        { provide: UsersService, useValue: { listManagers: vi.fn().mockResolvedValue([manager]) } },
        { provide: UiDialogService, useValue: { open } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CalendarPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, list, open, selectedOfficeId, navigate };
  }

  it('loads the office-local week and switches to the manager day grid', async () => {
    const { fixture, list } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: office.id, managerId: undefined }),
    );
    expect(element.querySelector('.week-grid')).not.toBeNull();
    expect(element.textContent).toContain('Анна Коваль');
    expect(element.textContent).toContain('Ірина Бондар');
    expect(element.textContent).toContain('Максим Левченко');
    expect(element.textContent).toContain('Олена Савчук');
    expect(element.querySelector('.week-card .appointment-comment')?.textContent).toContain(
      'Підготувати документи для зустрічі',
    );
    expect(element.querySelector('.agenda-card .appointment-comment')?.textContent).toContain(
      'Підготувати документи для зустрічі',
    );
    expect(element.textContent).not.toContain('Старий запис');
    expect(element.querySelector('.week-card.is-visited')).not.toBeNull();
    expect(element.querySelector('.week-card.is-no-show')).not.toBeNull();
    expect(element.querySelector('.week-card.is-canceled')).not.toBeNull();

    const dayButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.view-switch button'),
    ).find((button) => button.textContent?.includes('День'))!;
    dayButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.day-grid')).not.toBeNull();
    expect(element.textContent).toContain('Олена');
    expect(element.querySelector('.appointment-card .appointment-comment')?.textContent).toContain(
      'Підготувати документи для зустрічі',
    );
  });

  it('opens the drawer from a week appointment and has no basic AXE violations', async () => {
    const { fixture, open } = await render();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.week-card')!.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          appointment: expect.objectContaining({ id: 'appointment-1' }),
        }),
        position: { right: '0', top: '0' },
      }),
    );
    expect((await axe.run(element)).violations).toEqual([]);
  });

  it('opens the drawer from lead deep-link query params and clears them', async () => {
    const { open, navigate } = await render({
      leadId: 'lead-1',
      date: '2026-07-23',
      officeId: office.id,
    });
    await vi.waitFor(() => expect(open).toHaveBeenCalled());

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          appointment: expect.objectContaining({ id: 'appointment-1' }),
        }),
      }),
    );
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: {},
        replaceUrl: true,
      }),
    );
  });

  it('reloads appointments when the global office changes', async () => {
    const { list, selectedOfficeId } = await render();
    list.mockClear();

    selectedOfficeId.set(warsawOffice.id);
    await vi.waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ officeId: warsawOffice.id, managerId: undefined }),
      ),
    );
  });
});
