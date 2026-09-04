import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import axe from 'axe-core';
import { of } from 'rxjs';

import type { Appointment } from '@core/api/generated/kolss-api.types';
import { SessionService } from '@core/session/session.service';
import { AppointmentsService } from '@services/appointments.service';
import type { Lead } from '@domain/lead.types';
import { LeadsService } from '@services/leads.service';
import { type CrmEmployee, UsersService } from '@services/users.service';
import { UiDialogService } from '@ui/dialog/ui-dialog';
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
  lead: {
    id: 'lead-1',
    referenceId: 'k0001',
    name: 'Анна Коваль',
    phone: '+380501112233',
  },
  office: {
    id: office.id,
    code: office.code,
    name: office.name_uk,
    timezoneName: office.timezone_name,
  },
  responsibleManager: { id: manager.id, displayName: manager.displayName },
  kind: 'showroom',
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
  lead: {
    id: 'lead-visited',
    referenceId: 'k0002',
    name: 'Ірина Бондар',
    phone: '+380501112244',
  },
  kind: 'showroom',
  startsAt: '2026-07-23T08:00:00.000Z',
  endsAt: '2026-07-23T09:00:00.000Z',
  status: 'visited',
  version: 2,
};

const noShowAppointment: Appointment = {
  ...appointment,
  id: 'appointment-no-show',
  lead: {
    id: 'lead-no-show',
    referenceId: 'k0003',
    name: 'Максим Левченко',
    phone: '+380501112255',
  },
  kind: 'showroom',
  startsAt: '2026-07-23T09:00:00.000Z',
  endsAt: '2026-07-23T10:00:00.000Z',
  status: 'no_show',
  version: 2,
};

const canceledAppointment: Appointment = {
  ...appointment,
  id: 'appointment-canceled',
  lead: {
    id: 'lead-canceled',
    referenceId: 'k0004',
    name: 'Олена Савчук',
    phone: '+380501112266',
  },
  kind: 'showroom',
  startsAt: '2026-07-23T10:00:00.000Z',
  endsAt: '2026-07-23T11:00:00.000Z',
  status: 'canceled',
  version: 2,
};

const measurementAppointment: Appointment = {
  ...appointment,
  id: 'appointment-measurement',
  lead: {
    id: 'lead-measurement',
    referenceId: 'k0005',
    name: 'Тарас Мельник',
    phone: '+380501112288',
  },
  kind: 'measurement',
  startsAt: '2026-07-23T12:00:00.000Z',
  endsAt: '2026-07-23T14:00:00.000Z',
  version: 2,
};

const officeWorkAppointment: Appointment = {
  ...appointment,
  id: 'appointment-office-work',
  lead: {
    id: 'lead-office-work',
    referenceId: 'k0007',
    name: 'Офісна робота',
    phone: '+380501112299',
  },
  kind: 'office_work',
  startsAt: '2026-07-23T14:00:00.000Z',
  endsAt: '2026-07-23T17:00:00.000Z',
  comment: 'Підготувати проєкт',
};

const rescheduledAppointment: Appointment = {
  ...appointment,
  id: 'appointment-rescheduled',
  lead: {
    id: 'lead-rescheduled',
    referenceId: 'k0006',
    name: 'Старий запис',
    phone: '+380501112277',
  },
  kind: 'showroom',
  startsAt: '2026-07-23T11:00:00.000Z',
  endsAt: '2026-07-23T12:00:00.000Z',
  status: 'rescheduled',
  version: 2,
};

// Overdue-visit fixtures: dated before the fake "today" (2026-07-23), used to
// verify the `due=overdue` list counts a visit strictly the way the digest
// does — still `status: 'scheduled'` but past its date. A visit already
// visited/canceled/no-show is done, not forgotten, and must not appear.
const overdueScheduledVisit: Appointment = {
  ...appointment,
  id: 'appointment-overdue-scheduled',
  lead: {
    id: 'lead-overdue-visit',
    referenceId: 'k0007',
    name: 'Забутий Візит',
    phone: '+380501112299',
  },
  kind: 'showroom',
  startsAt: '2026-07-19T07:00:00.000Z',
  endsAt: '2026-07-19T08:00:00.000Z',
  status: 'scheduled',
  version: 1,
};

const overdueVisitedVisit: Appointment = {
  ...appointment,
  id: 'appointment-overdue-visited',
  lead: {
    id: 'lead-overdue-done',
    referenceId: 'k0008',
    name: 'Проведений Візит',
    phone: '+380501112300',
  },
  kind: 'showroom',
  startsAt: '2026-07-18T07:00:00.000Z',
  endsAt: '2026-07-18T09:00:00.000Z',
  status: 'visited',
  version: 1,
};

const overdueCanceledVisit: Appointment = {
  ...appointment,
  id: 'appointment-overdue-canceled',
  lead: {
    id: 'lead-overdue-canceled',
    referenceId: 'k0009',
    name: 'Скасований Візит',
    phone: '+380501112301',
  },
  kind: 'measurement',
  startsAt: '2026-07-17T07:00:00.000Z',
  endsAt: '2026-07-17T09:00:00.000Z',
  status: 'canceled',
  version: 1,
};

/** Well outside the 365-day lookback (`OVERDUE_LOOKBACK_DAYS`) — must never
 * surface, even though it's still `status: 'scheduled'`. */
const overdueTooOldVisit: Appointment = {
  ...appointment,
  id: 'appointment-overdue-too-old',
  lead: {
    id: 'lead-overdue-too-old',
    referenceId: 'k0010',
    name: 'Дуже Старий Візит',
    phone: '+380501112302',
  },
  kind: 'showroom',
  startsAt: '2025-01-01T07:00:00.000Z',
  endsAt: '2025-01-01T09:00:00.000Z',
  status: 'scheduled',
  version: 1,
};

const baseLead: Lead = {
  id: 'lead-base',
  referenceId: 'k0099',
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
  estimatedBudgetCurrency: 'UAH',
  assignedToId: null,
  firstManagerId: null,
  firstCall: null,
  visit: null,
  close: null,
  contract: null,
  callbackDueAt: null,
  commentReminderDueAt: null,
  commentReminderAssignedTo: null,
  lastComment: null,
  latestTimelineComment: null,
  lastActivityAt: '2026-07-20T00:00:00.000Z',
  attachments: [],
  events: [],
  markers: [],
};

const callbackLead: Lead = {
  ...baseLead,
  id: 'lead-callback',
  name: 'Callback Клієнт',
  phone: '+380501110001',
  assignedToId: 'manager-1',
  callStatus: 'callback_requested',
  callStatusChangedAt: '2026-07-22T00:00:00.000Z',
  callbackDueAt: '2026-07-23T09:00:00.000Z',
};

const commentLead: Lead = {
  ...baseLead,
  id: 'lead-comment',
  name: 'Comment Клієнт',
  phone: '+380501110002',
  assignedToId: 'manager-2',
  commentReminderDueAt: '2026-07-24T09:00:00.000Z',
};

/** client_status 'thinking' with a due date — the §3 investigation's gap: it
 * carries callStatus !== 'callback_requested', so it must be reachable via
 * clientStatus alone, not the callback branch. */
const thinkingLead: Lead = {
  ...baseLead,
  id: 'lead-thinking',
  name: 'Thinking Клієнт',
  phone: '+380501110003',
  assignedToId: 'manager-1',
  clientStatus: 'thinking',
  callbackDueAt: '2026-07-23T10:00:00.000Z',
};

const postponedLead: Lead = {
  ...baseLead,
  id: 'lead-postponed',
  referenceId: 'k0102',
  name: 'Postponed Клієнт',
  assignedToId: 'manager-1',
  clientStatus: 'postponed',
  callbackDueAt: '2026-07-23T11:00:00.000Z',
};

/**
 * `callStatus` and `clientStatus` are independent columns, so a single lead
 * can carry both an active callback reminder and an active thinking reminder
 * at once — each must render as its own overdue row, never merged into one
 * per lead (per the digest's "count rows, not leads" contract).
 */
const overdueMultiKindLead: Lead = {
  ...baseLead,
  id: 'lead-overdue-multi',
  name: 'Прострочений Клієнт',
  assignedToId: 'manager-1',
  callStatus: 'callback_requested',
  callStatusChangedAt: '2026-07-18T00:00:00.000Z',
  clientStatus: 'thinking',
  callbackDueAt: '2026-07-20T09:00:00.000Z',
};

/** Leads matching `overdueScheduledVisit`/`overdueVisitedVisit`/`overdueCanceledVisit`
 * above by id — `overdueReminders` looks the appointment's lead up in
 * `leadsResource` to build a full `CalendarOverdueRow`. */
const overdueVisitLead: Lead = { ...baseLead, id: 'lead-overdue-visit', name: 'Забутий Візит' };
const overdueDoneVisitLead: Lead = {
  ...baseLead,
  id: 'lead-overdue-done',
  name: 'Проведений Візит',
};
const overdueCanceledVisitLead: Lead = {
  ...baseLead,
  id: 'lead-overdue-canceled',
  name: 'Скасований Візит',
};
const overdueTooOldVisitLead: Lead = {
  ...baseLead,
  id: 'lead-overdue-too-old',
  name: 'Дуже Старий Візит',
};

/** Comment reminder more than OVERDUE_LOOKBACK_DAYS (365) before "today"
 * (2026-07-23) — mirrors overdueTooOldVisit, but for the lead-derived branch
 * (activeRemindersForLead), which has no implicit range bound the way the
 * windowed appointments fetch does. */
const overdueTooOldCommentLead: Lead = {
  ...baseLead,
  id: 'lead-overdue-too-old-comment',
  name: 'Дуже Старий Коментар',
  assignedToId: 'manager-1',
  commentReminderDueAt: '2025-01-01T09:00:00.000Z',
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
  // The component derives its default selected date from the real clock
  // (`officeDateKey(new Date(), …)`), while every fixture here is dated in the
  // week of 2026-07-20. Without a fixed clock the week-view specs silently stop
  // matching once the real date rolls into the next week.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-23T09:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultAppointments: readonly Appointment[] = [
    appointment,
    visitedAppointment,
    noShowAppointment,
    canceledAppointment,
    measurementAppointment,
    rescheduledAppointment,
  ];

  async function render(
    queryParams: Record<string, string> = {},
    managers: readonly CrmEmployee[] = [manager],
    leads: readonly Lead[] = [callbackLead, commentLead],
    sessionOverrides: Record<string, unknown> = {},
    appointments: readonly Appointment[] = defaultAppointments,
  ) {
    TestBed.resetTestingModule();
    const selectedOfficeId = signal<string | null>(office.id);
    // Filters by the requested [from, to) window, like the real endpoint —
    // required so `due=overdue`'s several windowed requests don't each
    // return every fixture and duplicate rows. Deliberately does NOT filter
    // by `status`: that's what lets the "server ignores status" defensive
    // test below prove the component checks it client-side too.
    const list = vi.fn((range: { from: string; to: string }) =>
      Promise.resolve({
        items: appointments.filter((item) => {
          const date = item.startsAt.slice(0, 10);
          return date >= range.from && date < range.to;
        }),
        timezone: office.timezone_name,
        from: range.from,
        to: range.to,
      }),
    );
    const listLeads = vi.fn().mockResolvedValue(leads);
    const open = vi.fn().mockReturnValue({ afterClosed: () => of(undefined) });
    const navigate = vi.fn().mockResolvedValue(true);
    const setOfficeFilter = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CalendarPage],
      providers: [
        {
          provide: SessionService,
          useValue: {
            selectedOfficeId,
            officeContext: () => ({ filterOffices: [office, warsawOffice], canFilter: true }),
            loaded: () => true,
            showOfficeFilter: () => true,
            setOfficeFilter,
            locale: () => 'uk',
            ...sessionOverrides,
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
    return { fixture, list, listLeads, open, selectedOfficeId, navigate, setOfficeFilter };
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
    expect(element.querySelector('.week-card app-lead-reference')?.textContent).toContain('k0001');
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
    expect(element.textContent).toContain('Старий запис');
    expect(element.querySelector('.week-card.is-visited')).not.toBeNull();
    expect(element.querySelector('.week-card.is-no-show')).not.toBeNull();
    expect(element.querySelector('.week-card.is-canceled')).not.toBeNull();
    expect(element.querySelector('.week-card.is-rescheduled')).not.toBeNull();

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

  it('marks measurement appointments apart from showroom meetings', async () => {
    const { fixture, open } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const measurementCard = element.querySelector('.week-card.is-measurement');
    expect(measurementCard).not.toBeNull();
    expect(measurementCard?.textContent).toContain('Тарас Мельник');
    expect(element.querySelectorAll('.week-card.is-measurement')).toHaveLength(1);
    expect(
      measurementCard?.querySelector('app-calendar-event-card')?.getAttribute('title'),
    ).toContain('Замір у клієнта');
    expect(element.querySelector('.kind-legend')?.textContent).toContain('Замір у клієнта');

    const measurementButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.header-actions button'),
    ).find((button) => button.textContent?.includes('Замір у клієнта'))!;
    measurementButton.click();
    await fixture.whenStable();

    expect(open.mock.calls[0]?.[1]?.data).toEqual(expect.objectContaining({ kind: 'measurement' }));
  });

  it('renders office work in every calendar layout and excludes it from visit filters', async () => {
    const { fixture } = await render({}, [manager], [], {}, [officeWorkAppointment]);
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.week-card.is-office-work')).not.toBeNull();
    expect(element.querySelector('[data-event-kind="office_work"]')?.textContent).toContain(
      'Робота в офісі',
    );
    expect(
      element.querySelector('[data-event-kind="office_work"]')?.getAttribute('title'),
    ).toContain('Підготувати проєкт');
    expect(element.querySelector('.agenda-card.is-office-work')).not.toBeNull();

    fixture.componentInstance['view'].set('month');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('.month-card.is-office-work')).not.toBeNull();

    fixture.componentInstance['reminderKindFilter'].set('visit');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    expect(element.querySelector('.appointment-card.is-office-work')).toBeNull();
    expect(fixture.componentInstance['filteredReminderCount']()).toBe(0);
  });

  it('opens the three-kind creation menu from the week footer', async () => {
    const { fixture, open } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const weekColumns = element.querySelector<HTMLElement>('.week-columns')!;
    const addRow = element.querySelector<HTMLElement>('.week-add-row')!;
    const addButtons = addRow.querySelectorAll<HTMLButtonElement>('.create-trigger');

    expect(weekColumns.nextElementSibling).toBe(addRow);
    expect(addButtons).toHaveLength(6);
    expect(weekColumns.querySelector('.create-trigger')).toBeNull();

    addButtons[2]!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const menuItems = addRow.querySelectorAll<HTMLButtonElement>(
      '.create-panel--visible .create-item',
    );
    expect(menuItems).toHaveLength(3);
    expect(Array.from(menuItems).map((item) => item.textContent?.trim())).toEqual([
      'Зустріч у салоні',
      'Замір у клієнта',
      'Робота в офісі',
    ]);

    menuItems[2]!.click();
    await fixture.whenStable();

    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          date: '2026-07-22',
          time: '10:00',
          kind: 'office_work',
        }),
      }),
    );
  });

  it('opens the creation menu from the keyboard and restores trigger focus on Escape', async () => {
    const { fixture } = await render();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector<HTMLButtonElement>('.week-add-row .create-trigger')!;

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = element.querySelector<HTMLElement>('.create-panel--visible');
    expect(panel).not.toBeNull();
    expect(document.activeElement).toBe(trigger);

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('.create-panel--visible')).toBeNull();
    expect(document.activeElement).toBe(trigger);
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
    const heads = Array.from(element.querySelectorAll('.manager-head strong')).map((node) =>
      node.textContent?.trim(),
    );
    expect(heads).toEqual(['Олена']);
    expect(element.textContent).not.toContain('Деактивований');
    expect(element.textContent).not.toContain('Куратор Офісу');
    expect(element.textContent).not.toContain('Адмін Офісу');
    expect(element.textContent).not.toContain('Варшавський');
  });

  it('loads the padded month range and opens day view from a month day number', async () => {
    const { fixture, list, open } = await render();
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
    expect(element.querySelector('.month-card app-lead-reference')?.textContent).toContain('k0099');
    expect(element.querySelector('.week-grid')).toBeNull();
    expect(element.textContent).toContain('Анна Коваль');
    expect(element.querySelector('.month-card.is-visited')).not.toBeNull();

    const dayNumber = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.month-day-number'),
    ).find((button) => button.textContent?.trim() === '23' && !button.closest('.is-outside'))!;
    const dayCell = dayNumber.closest<HTMLElement>('.month-day')!;
    dayCell.querySelector<HTMLButtonElement>('.create-trigger--month')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const officeWorkItem = dayCell.querySelector<HTMLButtonElement>(
      '.create-panel--visible .create-item[value="office_work"]',
    );
    expect(officeWorkItem).not.toBeNull();
    officeWorkItem!.click();
    await fixture.whenStable();
    expect(open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ date: '2026-07-23', kind: 'office_work' }),
      }),
    );

    dayNumber.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.day-grid')).not.toBeNull();
    expect(fixture.componentInstance['selectedDate']()).toBe('2026-07-23');
    expect(fixture.componentInstance['view']()).toBe('day');
  });

  it('shows every month item in reminder-first order without an overflow counter', async () => {
    const sameDayComment: Lead = {
      ...commentLead,
      commentReminderDueAt: '2026-07-23T12:00:00.000Z',
    };
    const sameDayTask: Lead = {
      ...baseLead,
      id: 'lead-task',
      referenceId: 'k0103',
      name: 'Task Клієнт',
      commentReminderDueAt: '2026-07-23T13:00:00.000Z',
      commentReminderAssignedTo: manager.id,
    };
    const { fixture } = await render(
      {},
      [manager],
      [callbackLead, thinkingLead, postponedLead, sameDayComment, sameDayTask],
      {},
      [appointment],
    );
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('month');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const entries = fixture.componentInstance['monthEntries']('2026-07-23');
    expect(entries.map((entry) => entry.card.kind)).toEqual([
      'callback',
      'thinking',
      'postponed',
      'comment',
      'task',
      'showroom',
    ]);

    const day = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.month-day'),
    ).find(
      (cell) =>
        !cell.classList.contains('is-outside') &&
        cell.querySelector('.month-day-number')?.textContent?.trim() === '23',
    )!;
    expect(day.querySelectorAll('.month-card')).toHaveLength(6);
    expect(day.querySelector('.month-more')).toBeNull();
  });

  it('includes reminder-only dates in the mobile month agenda', async () => {
    const { fixture } = await render({}, [manager], [commentLead], {}, []);
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('month');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance['agendaGroups']().map((group) => group.date)).toContain(
      '2026-07-24',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.mobile-agenda')?.textContent,
    ).toContain('Comment Клієнт');
  });

  it('uses a two-row compact card for a 15-minute appointment in day view', async () => {
    const shortAppointment: Appointment = {
      ...appointment,
      id: 'appointment-short',
      endsAt: '2026-07-23T07:15:00.000Z',
    };
    const { fixture } = await render({}, [manager], [], {}, [shortAppointment]);
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.appointment-card',
    )!;
    expect(card.style.height).toBe('48px');
    expect(card.querySelector('.event-card.is-compact')).not.toBeNull();
    expect(card.querySelector('.event-footer')).toBeNull();
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

  it('falls back to unassigned when a reminder has no assignee or lead manager', async () => {
    const unassignedCallback: Lead = {
      ...callbackLead,
      id: 'lead-unassigned-callback',
      assignedToId: null,
      name: 'Без менеджера',
    };
    const { fixture } = await render({}, [manager], [unassignedCallback]);
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const reminder = (fixture.nativeElement as HTMLElement).querySelector('.reminder-chip');
    expect(reminder?.querySelector('.event-footer')?.textContent).toContain('Не призначено');
  });

  it('puts office_member tasks in the day column and keeps other assignees in the banner', async () => {
    const memberTask: Lead = {
      ...baseLead,
      id: 'lead-member-task',
      name: 'Member Task',
      commentReminderDueAt: '2026-07-23T09:00:00.000Z',
      commentReminderAssignedTo: manager.id,
    };
    const curatorTask: Lead = {
      ...baseLead,
      id: 'lead-curator-task',
      name: 'Curator Task',
      commentReminderDueAt: '2026-07-23T09:00:00.000Z',
      commentReminderAssignedTo: curator.id,
    };
    const { fixture } = await render(
      {},
      [manager, curator, officeAdmin],
      [memberTask, curatorTask],
    );
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const heads = Array.from(element.querySelectorAll('.manager-head strong')).map((node) =>
      node.textContent?.trim(),
    );
    expect(heads).toEqual(['Олена']);

    const allDay = element.querySelector('.all-day-row');
    expect(allDay?.querySelector('.reminder-chip.is-task')?.textContent).toContain('Member Task');
    expect(allDay?.textContent).not.toContain('Curator Task');

    const banner = element.querySelector('.day-reminders-banner');
    expect(banner?.querySelector('.reminder-chip.is-task')?.textContent).toContain('Curator Task');
    expect(banner?.textContent).toContain('Куратор Офісу');
    expect(banner?.textContent).not.toContain('Member Task');
  });

  it('drops reminders of closed leads from the calendar', async () => {
    const closedCallback: Lead = {
      ...callbackLead,
      id: 'lead-closed-callback',
      name: 'Закритий Callback',
      clientStatus: 'closed_lost',
    };
    const signedTask: Lead = {
      ...baseLead,
      id: 'lead-signed-task',
      name: 'Підписаний Договір',
      clientStatus: 'contract_signed',
      commentReminderDueAt: '2026-07-23T09:00:00.000Z',
      commentReminderAssignedTo: manager.id,
    };
    const { fixture } = await render({}, [manager], [closedCallback, signedTask]);
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.reminder-chip')).toBeNull();
    expect(element.textContent).not.toContain('Закритий Callback');
    expect(element.textContent).not.toContain('Підписаний Договір');
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

  it('renders a thinking reminder chip — client_status thinking has no callback_requested call status', async () => {
    const { fixture } = await render({}, [manager], [callbackLead, commentLead, thinkingLead]);
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.reminder-chip app-lead-reference')?.textContent).toContain(
      'k0099',
    );

    const chip = element.querySelector('.reminder-chip.is-thinking');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain('Thinking Клієнт');
  });

  it('filters the day to one digest group via a kind + date deep link, and shows a removable count chip', async () => {
    const { fixture } = await render(
      { kind: 'callback', date: '2026-07-23' },
      [manager],
      [callbackLead, commentLead, thinkingLead],
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance['view']()).toBe('day');
    expect(element.querySelector('.day-grid')).not.toBeNull();
    expect(element.querySelector('.reminder-chip.is-callback')).not.toBeNull();
    expect(element.querySelector('.reminder-chip.is-thinking')).toBeNull();
    expect(element.textContent).not.toContain('Comment Клієнт');

    const filterChip = element.querySelector('.filter-chips');
    expect(filterChip?.textContent).toContain('Перезвони на сьогодні');
    expect(filterChip?.textContent).toContain('1');

    filterChip!.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.filter-chips')).toBeNull();
    expect(element.querySelector('.reminder-chip.is-thinking')).not.toBeNull();
  });

  it('a visit deep link hides reminder chips and narrows cards to still-scheduled visits, matching the digest count', async () => {
    const { fixture } = await render(
      { kind: 'visit', date: '2026-07-23' },
      [manager],
      [callbackLead, commentLead, thinkingLead],
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.reminder-chip')).toBeNull();

    // Fixture day 2026-07-23 has 5 non-rescheduled appointments, only 2 of
    // which are still `status: 'scheduled'` (appointment + measurementAppointment).
    const cards = element.querySelectorAll('.appointment-card');
    expect(cards).toHaveLength(2);
    expect(element.textContent).toContain('Анна Коваль');
    expect(element.textContent).toContain('Тарас Мельник');
    expect(element.textContent).not.toContain('Ірина Бондар'); // visited
    expect(element.textContent).not.toContain('Максим Левченко'); // no_show
    expect(element.textContent).not.toContain('Олена Савчук'); // canceled

    expect(element.querySelector('.filter-chips')?.textContent).toContain('Візити в салон');
    expect(element.querySelector('.filter-chips')?.textContent).toContain('2');
  });

  it('leaves the normal (unfiltered) calendar view showing every appointment status', async () => {
    const { fixture } = await render();
    fixture.componentInstance['selectedDate'].set('2026-07-23');
    fixture.componentInstance['view'].set('day');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    // No kind=visit filter active — every status (incl. visited/no_show/canceled/rescheduled)
    // must still render, unlike the filtered case above.
    expect(element.querySelectorAll('.appointment-card')).toHaveLength(6);
    expect(element.textContent).toContain('Ірина Бондар');
    expect(element.textContent).toContain('Максим Левченко');
    expect(element.textContent).toContain('Олена Савчук');
    expect(element.textContent).toContain('Старий запис');
  });

  it('an overdue deep link replaces the grid with a flat list, one row per reminder even for the same lead', async () => {
    const { fixture } = await render(
      { due: 'overdue' },
      [manager],
      [overdueMultiKindLead, overdueVisitLead, overdueDoneVisitLead, overdueCanceledVisitLead],
      {},
      [overdueScheduledVisit, overdueVisitedVisit, overdueCanceledVisit],
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.week-grid')).toBeNull();
    expect(element.querySelector('.day-grid')).toBeNull();
    expect(element.textContent).toContain('Прострочені нагадування');

    const rows = element.querySelectorAll('.overdue-row');
    // 2 lead-derived rows (callback + thinking, same lead) + 1 still-scheduled
    // visit. The visited/canceled visits are done, not forgotten — excluded.
    // Sorted chronologically, so don't assume which index is which.
    expect(rows).toHaveLength(3);
    const rowTexts = Array.from(rows).map((row) => row.textContent ?? '');
    expect(rowTexts.filter((text) => text.includes('Прострочений Клієнт'))).toHaveLength(2);
    expect(rowTexts.filter((text) => text.includes('Забутий Візит'))).toHaveLength(1);
    expect(element.textContent).not.toContain('Проведений Візит');
    expect(element.textContent).not.toContain('Скасований Візит');

    const exitButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.date-navigation button'),
    ).find((button) => button.textContent?.includes('Повернутися до календаря'))!;
    exitButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance['overdueMode']()).toBe(false);
    expect(element.querySelector('.overdue-row')).toBeNull();
  });

  it('excludes visited/canceled visits from the overdue list even when the mock ignores the requested status filter', async () => {
    const { fixture } = await render(
      { due: 'overdue' },
      [manager],
      [overdueDoneVisitLead, overdueCanceledVisitLead],
      {},
      [overdueVisitedVisit, overdueCanceledVisit],
    );
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.overdue-row')).toBeNull();
    expect(element.querySelector('.overdue-empty')).not.toBeNull();
  });

  it('excludes office work from overdue reminder rows', async () => {
    const overdueOfficeWork: Appointment = {
      ...officeWorkAppointment,
      startsAt: '2026-07-20T07:00:00.000Z',
      endsAt: '2026-07-20T08:00:00.000Z',
    };
    const officeWorkLead: Lead = {
      ...baseLead,
      id: overdueOfficeWork.lead.id,
      name: overdueOfficeWork.lead.name,
    };
    const { fixture } = await render({ due: 'overdue' }, [manager], [officeWorkLead], {}, [
      overdueOfficeWork,
    ]);

    expect((fixture.nativeElement as HTMLElement).querySelector('.overdue-row')).toBeNull();
  });

  it('never requests an appointments window wider than 63 days, even across a 365-day overdue lookback', async () => {
    // GET /v1/appointments rejects to-from over 63 days (internal/crmapi/appointments.go);
    // this is the regression a mocked AppointmentsService can't otherwise catch.
    const { list } = await render({ due: 'overdue' }, [manager], [], {}, []);

    expect(list.mock.calls.length).toBeGreaterThan(1);
    for (const call of list.mock.calls) {
      const range = call[0] as { from: string; to: string };
      const days = (Date.parse(range.to) - Date.parse(range.from)) / (24 * 60 * 60 * 1000);
      expect(days).toBeLessThanOrEqual(63);
    }
  });

  it('excludes an overdue visit older than the 365-day lookback even though it is still scheduled', async () => {
    const { fixture } = await render({ due: 'overdue' }, [manager], [overdueTooOldVisitLead], {}, [
      overdueTooOldVisit,
    ]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.overdue-row')).toBeNull();
    expect(element.textContent).not.toContain('Дуже Старий Візит');
  });

  it('excludes a lead-derived reminder (comment/callback/thinking) older than the 365-day lookback', async () => {
    // Unlike the appointments branch, activeRemindersForLead has no implicit
    // range bound (leadsResource loads every active lead) — this is the
    // asymmetry that let a >365-day-old comment reminder inflate the list
    // past what internal/leadcohorts counts.
    const { fixture } = await render({ due: 'overdue' }, [manager], [overdueTooOldCommentLead]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.overdue-row')).toBeNull();
    expect(element.textContent).not.toContain('Дуже Старий Коментар');
  });

  it('defaults the manager filter to "all" on an office+overdue deep link, matching the digest\'s office-wide count', async () => {
    // internal/leadcohorts counts per office, not per manager — if the
    // manager filter defaulted to anything but 'all' here, the manager
    // would see fewer rows than the digest's count.
    const { fixture, setOfficeFilter } = await render({ office: 'warsaw', due: 'overdue' });

    expect(setOfficeFilter).toHaveBeenCalledWith('warsaw');
    expect(fixture.componentInstance['managerId']()).toBe('all');
  });

  it('shows the empty state when there is nothing overdue', async () => {
    const { fixture } = await render({ due: 'overdue' }, [manager], []);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.overdue-empty')).not.toBeNull();
    expect(element.querySelector('.overdue-row')).toBeNull();
  });

  it('applies a digest-linked office the user can filter by', async () => {
    const { setOfficeFilter } = await render({ office: 'warsaw' });

    expect(setOfficeFilter).toHaveBeenCalledWith('warsaw');
  });

  it('ignores a digest-linked office the user has no access to', async () => {
    const { setOfficeFilter } = await render({ office: 'warsaw' }, [manager], [callbackLead], {
      officeContext: () => ({ filterOffices: [office], canFilter: true }),
    });

    expect(setOfficeFilter).not.toHaveBeenCalledWith('warsaw');
  });

  it('keeps the digest filter shareable by persisting it back to the URL', async () => {
    const { navigate } = await render({ kind: 'reminder', date: '2026-07-23' });

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({
          office: 'kyiv',
          date: '2026-07-23',
          kind: 'reminder',
        }),
        replaceUrl: true,
      }),
    );
  });
});
