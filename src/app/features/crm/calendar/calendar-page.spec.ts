import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import axe from 'axe-core';
import { of } from 'rxjs';

import type { Appointment } from '../../../core/api/generated/kolss-api.types';
import { SessionService } from '../../../core/session/session.service';
import { AppointmentsService } from '../../../services/appointments.service';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { type CrmEmployee, UsersService } from '../../../services/users.service';
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

const baseLead: MockLead = {
  id: 'lead-base',
  name: 'Base',
  phone: '+380500000000',
  email: null,
  leadStatus: 'in_progress',
  workflowStatus: 'taken',
  callStatus: null,
  callStatusChangedAt: null,
  clientStatus: 'new_lead',
  clientStatusChangedAt: '2026-07-20T00:00:00.000Z',
  officeCode: 'kyiv',
  source: 'website',
  sourceCreatedAt: '2026-07-18T00:00:00.000Z',
  initialMessage: '',
  cityRegion: '',
  productInterest: '',
  estimatedBudget: null,
  assignedToId: null,
  firstManagerId: null,
  firstCall: null,
  visit: null,
  close: null,
  contract: null,
  callbackDueAt: null,
  commentReminderDueAt: null,
  lastComment: null,
  latestTimelineComment: null,
  lastActivityAt: '2026-07-20T00:00:00.000Z',
  attachments: [],
  events: [],
  markers: [],
};

const callbackLead: MockLead = {
  ...baseLead,
  id: 'lead-callback',
  name: 'Callback Клієнт',
  phone: '+380501110001',
  assignedToId: 'manager-1',
  callStatus: 'callback_requested',
  callStatusChangedAt: '2026-07-22T00:00:00.000Z',
  callbackDueAt: '2026-07-23T09:00:00.000Z',
};

const commentLead: MockLead = {
  ...baseLead,
  id: 'lead-comment',
  name: 'Comment Клієнт',
  phone: '+380501110002',
  assignedToId: 'manager-2',
  commentReminderDueAt: '2026-07-24T09:00:00.000Z',
};

const inactiveManager = {
  ...manager,
  id: 'manager-inactive',
  displayName: 'Деактивований',
  status: 'inactive' as const,
};

const curator = {
  ...manager,
  id: 'manager-curator',
  displayName: 'Куратор Офісу',
  role: 'curator' as const,
};

const officeAdmin = {
  ...manager,
  id: 'manager-admin',
  displayName: 'Адмін Офісу',
  role: 'office_admin' as const,
};

const otherOfficeManager = {
  ...manager,
  id: 'manager-warsaw',
  displayName: 'Варшавський',
  officeIds: ['warsaw'] as const,
  officeUuids: ['office-warsaw'],
};

describe('CalendarPage', () => {
  async function render(
    queryParams: Record<string, string> = {},
    managers: readonly CrmEmployee[] = [manager],
    leads: readonly MockLead[] = [callbackLead, commentLead],
  ) {
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
    const listLeads = vi.fn().mockResolvedValue(leads);
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
        { provide: LeadsService, useValue: { list: listLeads } },
        { provide: UsersService, useValue: { listManagers: vi.fn().mockResolvedValue(managers) } },
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
    return { fixture, list, listLeads, open, selectedOfficeId, navigate };
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

  it('shows only active managers of the selected office in day view', async () => {
    const { fixture } = await render({}, [
      manager,
      inactiveManager,
      curator,
      officeAdmin,
      otherOfficeManager,
    ]);
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const heads = Array.from(element.querySelectorAll('.manager-head strong')).map(
      (node) => node.textContent?.trim(),
    );
    expect(heads).toEqual(['Олена']);
    expect(element.textContent).not.toContain('Деактивований');
    expect(element.textContent).not.toContain('Куратор Офісу');
    expect(element.textContent).not.toContain('Адмін Офісу');
    expect(element.textContent).not.toContain('Варшавський');
  });

  it('loads the padded month range and opens day view from a month day number', async () => {
    const { fixture, list } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.detectChanges();
    await fixture.whenStable();
    list.mockClear();

    const element = fixture.nativeElement as HTMLElement;
    const monthButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.view-switch button'),
    ).find((button) => button.textContent?.includes('Місяць'))!;
    monthButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        officeId: office.id,
        from: '2026-06-29',
        to: '2026-08-03',
        managerId: undefined,
      }),
    );
    expect(element.querySelector('.month-grid')).not.toBeNull();
    expect(element.querySelector('.week-grid')).toBeNull();
    expect(element.textContent).toContain('Анна Коваль');
    expect(element.querySelector('.month-card.is-visited')).not.toBeNull();

    const dayNumber = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.month-day-number'),
    ).find((button) => button.textContent?.trim() === '23' && !button.closest('.is-outside'))!;
    dayNumber.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.day-grid')).not.toBeNull();
    expect(fixture.componentInstance['selectedDate']()).toBe('2026-07-23');
    expect(fixture.componentInstance['view']()).toBe('day');
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

  it('buckets callback and comment reminders onto their office day', async () => {
    const { fixture, listLeads } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(listLeads).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: office.id, archived: 'active' }),
    );

    const banner23 = element.querySelector('.day-reminders-banner');
    expect(banner23).not.toBeNull();
    expect(banner23?.querySelector('.reminder-chip.is-callback')?.textContent).toContain(
      'Callback Клієнт',
    );
    expect(banner23?.textContent).not.toContain('Comment Клієнт');

    fixture.componentInstance['selectedDate'].set('2026-07-24');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const banner24 = element.querySelector('.day-reminders-banner');
    expect(banner24?.querySelector('.reminder-chip.is-comment')?.textContent).toContain(
      'Comment Клієнт',
    );
    expect(banner24?.textContent).not.toContain('Callback Клієнт');
  });

  it('narrows reminders by the selected manager filter', async () => {
    const { fixture } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('week');
    fixture.componentInstance['managerId'].set('manager-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.reminder-chip.is-callback')?.textContent).toContain(
      'Callback Клієнт',
    );
    expect(element.textContent).not.toContain('Comment Клієнт');
  });

  it('opens the lead drawer when a reminder is clicked', async () => {
    const { fixture, open } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('week');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const chip = element.querySelector<HTMLButtonElement>('.reminder-chip.is-callback');
    expect(chip).not.toBeNull();
    chip!.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          leadIds: ['lead-callback'],
          initialLeadId: 'lead-callback',
        }),
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
