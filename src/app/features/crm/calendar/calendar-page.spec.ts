import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
  comment: null,
  version: 1,
  hasConflict: false,
  isOutsideWorkingHours: false,
  warnings: [],
  createdAt: '2026-07-20T12:00:00.000Z',
  updatedAt: '2026-07-20T12:00:00.000Z',
};

describe('CalendarPage', () => {
  async function render() {
    const selectedOfficeId = signal<string | null>(office.id);
    const list = vi.fn().mockResolvedValue({
      items: [appointment],
      timezone: office.timezone_name,
      from: '2026-07-20',
      to: '2026-07-27',
    });
    const open = vi.fn().mockReturnValue({ afterClosed: () => of(undefined) });
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
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CalendarPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, list, open, selectedOfficeId };
  }

  it('loads the office-local week and switches to the manager day grid', async () => {
    const { fixture, list } = await render();
    const element = fixture.nativeElement as HTMLElement;

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: office.id, managerId: undefined }),
    );
    expect(element.querySelector('.week-grid')).not.toBeNull();
    expect(element.textContent).toContain('Анна Коваль');

    const dayButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.view-switch button'),
    ).find((button) => button.textContent?.includes('День'))!;
    dayButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.day-grid')).not.toBeNull();
    expect(element.textContent).toContain('Олена');
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

  it('reloads appointments when the global office changes', async () => {
    const { fixture, list, selectedOfficeId } = await render();
    list.mockClear();

    selectedOfficeId.set(warsawOffice.id);
    await fixture.whenStable();

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: warsawOffice.id, managerId: undefined }),
    );
  });
});
