import { Grid, GridCell, GridCellWidget, GridRow } from '@angular/aria/grid';
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { Appointment, AppointmentKind } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import { OFFICE_CONFIG } from '@core/office/office.config';
import { isOfficeMemberRole } from '@core/roles/roles';
import { SessionService } from '@core/session/session.service';
import type { Office } from '@models/database';
import {
  addCalendarDays,
  addCalendarMonths,
  AppointmentsService,
  type CalendarAppointmentDeepLink,
  mondayOfWeek,
  monthGridDays,
  monthGridRange,
  officeDateKey,
  officeDateTimeParts,
  parseCalendarAppointmentQuery,
  startOfCalendarMonth,
} from '@services/appointments.service';
import { commentAssigneeForLead, commentDueAtForLead, leadIsTerminal } from '@domain/lead.rules';
import type { Lead } from '@domain/lead.types';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { UiButton } from '@ui/button/ui-button';
import { UiSelect, type UiSelectOption } from '@ui/form/ui-select';
import { UiIcon, type UiIconName } from '@ui/icon/ui-icon';
import { UiDialogService } from '@ui/dialog/ui-dialog';
import {
  LeadDetailDrawer,
  type LeadDetailDrawerData,
  type LeadDetailDrawerResult,
  type LeadDetailDrawerState,
} from '@features/crm/leads/lead-detail-drawer';
import { openAppointmentDrawer, type AppointmentDrawerData } from './appointment-drawer';
import { CalendarDayReminders, type CalendarReminder } from './calendar-day-reminders';

type CalendarView = 'day' | 'week' | 'month';

const MONTH_VISIBLE_APPOINTMENTS = 3;
const EMPTY_REMINDERS: readonly CalendarReminder[] = [];

@Component({
  selector: 'app-calendar-page',
  imports: [
    Grid,
    GridCell,
    GridCellWidget,
    GridRow,
    UiButton,
    UiIcon,
    UiSelect,
    CalendarDayReminders,
  ],
  templateUrl: './calendar-page.html',
  styleUrl: './calendar-page.scss',
  host: {
    '[style.--manager-count]': 'visibleManagers().length || 1',
  },
})
export class CalendarPage {
  protected readonly i18n = inject(I18nService);
  private readonly session = inject(SessionService);
  private readonly appointments = inject(AppointmentsService);
  private readonly leads = inject(LeadsService);
  private readonly users = inject(UsersService);
  private readonly dialogs = inject(UiDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly incomingDeepLink = parseCalendarAppointmentQuery(
    this.route.snapshot.queryParamMap,
  );
  private readonly pendingDeepLink = signal<CalendarAppointmentDeepLink | null>(
    this.incomingDeepLink,
  );

  protected readonly view = signal<CalendarView>('week');
  protected readonly officeId = linkedSignal(
    () => this.session.selectedOfficeId() ?? this.availableOffices()[0]?.id ?? '',
  );
  protected readonly managerId = linkedSignal(() => {
    this.officeId();
    return 'all';
  });
  protected readonly selectedDate = signal(this.incomingDeepLink?.date ?? this.initialDate());
  protected readonly timeSlots = Array.from({ length: 20 }, (_, index) => {
    const minutes = 9 * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });

  constructor() {
    const deepLink = this.incomingDeepLink;
    if (deepLink && this.availableOffices().some((office) => office.id === deepLink.officeId)) {
      this.officeId.set(deepLink.officeId);
    }

    effect(() => {
      const pending = this.pendingDeepLink();
      if (!pending) return;
      if (this.appointmentsResource.isLoading()) return;
      if (this.officeId() !== pending.officeId) return;
      if (!this.rangeIncludesDate(pending.date)) return;

      const appointment = this.items().find((item) => item.lead.id === pending.leadId);
      untracked(() => {
        this.pendingDeepLink.set(null);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
        if (appointment) this.openEdit(appointment);
      });
    });
  }

  protected readonly office = computed(
    () => this.availableOffices().find((office) => office.id === this.officeId()) ?? null,
  );
  protected readonly todayKey = computed(() =>
    officeDateKey(new Date(), this.office()?.timezone_name ?? 'UTC'),
  );
  protected readonly weekStart = computed(() => mondayOfWeek(this.selectedDate()));
  protected readonly weekDays = computed(() =>
    Array.from({ length: 6 }, (_, index) => addCalendarDays(this.weekStart(), index)),
  );
  protected readonly monthDays = computed(() => monthGridDays(this.selectedDate()));
  protected readonly monthWeeks = computed(() => {
    const days = this.monthDays();
    const weeks: string[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      weeks.push([...days.slice(index, index + 7)]);
    }
    return weeks;
  });
  protected readonly monthWeekdayHeaders = computed(() => this.monthWeeks()[0] ?? []);
  private readonly range = computed(() => {
    if (this.view() === 'day') {
      return { from: this.selectedDate(), to: addCalendarDays(this.selectedDate(), 1) };
    }
    if (this.view() === 'month') {
      return monthGridRange(this.selectedDate());
    }
    return { from: this.weekStart(), to: addCalendarDays(this.weekStart(), 7) };
  });

  protected readonly managersResource = resource({
    loader: () => this.users.listManagers(),
  });
  protected readonly appointmentsResource = resource({
    params: () => ({
      officeId: this.officeId(),
      ...this.range(),
      managerId: this.managerId() === 'all' ? undefined : this.managerId(),
    }),
    loader: ({ params }) => {
      if (!params.officeId) {
        return Promise.resolve({ items: [], timezone: 'UTC', from: params.from, to: params.to });
      }
      return this.appointments.list(params);
    },
  });

  protected readonly leadsResource = resource({
    params: () => ({ officeId: this.officeId() }),
    loader: ({ params }) => {
      if (!params.officeId) return Promise.resolve([] as readonly Lead[]);
      return this.leads.list({ officeId: params.officeId, archived: 'active' });
    },
  });

  protected readonly items = computed(() => this.appointmentsResource.value()?.items ?? []);
  protected readonly managers = computed(() => this.managersResource.value() ?? []);
  /** Active office_member rows for the selected office — not curators/admins. */
  protected readonly officeManagers = computed(() =>
    this.managers().filter(
      (manager) =>
        manager.status === 'active' &&
        isOfficeMemberRole(manager.role) &&
        manager.officeUuids.includes(this.officeId()),
    ),
  );
  protected readonly visibleManagers = computed(() => {
    const managers = this.officeManagers();
    const selected = this.managerId();
    return selected !== 'all' ? managers.filter((manager) => manager.id === selected) : managers;
  });
  protected readonly officeOptions = computed<readonly UiSelectOption[]>(() =>
    this.availableOffices().map((office) => ({
      value: office.id,
      label: this.officeLabel(office),
    })),
  );
  protected readonly managerOptions = computed<readonly UiSelectOption[]>(() => [
    { value: 'all', label: this.i18n.t('calendar.allManagers') },
    ...this.officeManagers().map((manager) => ({
      value: manager.id,
      label: manager.displayName,
      userId: manager.id,
    })),
  ]);
  protected readonly sundayAppointments = computed(() => {
    if (this.view() !== 'week') return [];
    return this.appointmentsForDay(addCalendarDays(this.weekStart(), 6));
  });
  /**
   * Date-only lead reminders (blue callbacks, orange comment follow-ups) bucketed
   * by office day. Showroom due dates are excluded — they render as appointment
   * cards. Closed leads are excluded entirely. Honors the toolbar manager
   * filter; office is already scoped by the loaded resource.
   */
  private readonly remindersByDate = computed(() => {
    const leads = this.leadsResource.value() ?? [];
    const timeZone = this.office()?.timezone_name ?? 'UTC';
    const selectedManager = this.managerId();
    const byDate = new Map<string, CalendarReminder[]>();

    const push = (reminder: CalendarReminder) => {
      const bucket = byDate.get(reminder.date);
      if (bucket) bucket.push(reminder);
      else byDate.set(reminder.date, [reminder]);
    };

    for (const lead of leads) {
      if (leadIsTerminal(lead)) continue;

      const assigneeId = commentAssigneeForLead(lead);
      if (
        selectedManager !== 'all' &&
        lead.assignedToId !== selectedManager &&
        assigneeId !== selectedManager
      ) {
        continue;
      }

      if (lead.callStatus === 'callback_requested' && lead.callbackDueAt) {
        push({
          kind: 'callback',
          date: officeDateTimeParts(lead.callbackDueAt, timeZone).date,
          lead,
        });
      }

      const commentDueAt = commentDueAtForLead(lead);
      if (commentDueAt) {
        const date = officeDateTimeParts(commentDueAt, timeZone).date;
        if (assigneeId) {
          push({
            kind: 'task',
            date,
            lead,
            assigneeId,
            assigneeName: this.employeeName(assigneeId),
          });
        } else {
          push({ kind: 'comment', date, lead });
        }
      }
    }

    return byDate;
  });

  protected dayReminders(date: string): readonly CalendarReminder[] {
    return this.remindersByDate().get(date) ?? EMPTY_REMINDERS;
  }

  /**
   * Day-view banner reminders: everything except tasks that already appear as a
   * chip in a visible manager column. Tasks assigned to non–office_member staff
   * (no column) stay here so they are not lost.
   */
  protected dayBannerReminders(date: string): readonly CalendarReminder[] {
    const columnIds = new Set(this.visibleManagers().map((manager) => manager.id));
    return this.dayReminders(date).filter(
      (reminder) =>
        reminder.kind !== 'task' || !reminder.assigneeId || !columnIds.has(reminder.assigneeId),
    );
  }

  /** Date-only tasks for a manager's day column all-day strip. */
  protected dayColumnTasks(date: string, managerId: string): readonly CalendarReminder[] {
    return this.dayReminders(date).filter(
      (reminder) => reminder.kind === 'task' && reminder.assigneeId === managerId,
    );
  }

  protected hasDayColumnTasks(date: string): boolean {
    return this.visibleManagers().some(
      (manager) => this.dayColumnTasks(date, manager.id).length > 0,
    );
  }

  protected employeeName(id: string | null): string {
    if (!id) return this.i18n.t('common.unassigned');
    return (
      this.managers().find((manager) => manager.id === id)?.displayName ??
      this.i18n.t('common.unknown')
    );
  }

  protected readonly agendaGroups = computed(() => {
    if (this.view() === 'day') {
      return [{ date: this.selectedDate(), items: this.appointmentsForDay(this.selectedDate()) }];
    }
    if (this.view() === 'month') {
      const monthStart = startOfCalendarMonth(this.selectedDate());
      const nextMonth = addCalendarMonths(monthStart, 1);
      const groups: { date: string; items: readonly Appointment[] }[] = [];
      for (let date = monthStart; date < nextMonth; date = addCalendarDays(date, 1)) {
        const items = this.appointmentsForDay(date);
        if (items.length) groups.push({ date, items });
      }
      return groups.length
        ? groups
        : [{ date: this.selectedDate(), items: [] as readonly Appointment[] }];
    }
    return this.weekDays().map((date) => ({ date, items: this.appointmentsForDay(date) }));
  });
  protected readonly loadError = computed(() => {
    const error = this.appointmentsResource.error() ?? this.managersResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });
  protected readonly rangeLabel = computed(() => {
    if (this.view() === 'day') return this.fullDateLabel(this.selectedDate());
    if (this.view() === 'month') return this.monthLabel(this.selectedDate());
    const start = this.weekStart();
    const end = addCalendarDays(start, 5);
    return `${this.shortDateLabel(start)} — ${this.shortDateLabel(end)}`;
  });

  protected navigate(direction: number): void {
    if (this.view() === 'month') {
      this.selectedDate.update((date) => addCalendarMonths(date, direction));
      return;
    }
    this.selectedDate.update((date) =>
      addCalendarDays(date, direction * (this.view() === 'week' ? 7 : 1)),
    );
  }

  protected goToday(): void {
    this.selectedDate.set(this.todayKey());
  }

  protected openSunday(): void {
    this.selectedDate.set(addCalendarDays(this.weekStart(), 6));
    this.view.set('day');
  }

  protected openDay(date: string): void {
    this.selectedDate.set(date);
    this.view.set('day');
  }

  protected reload(): void {
    this.appointmentsResource.reload();
    this.managersResource.reload();
    this.leadsResource.reload();
  }

  protected openCreate(
    date = this.selectedDate(),
    time = '10:00',
    managerId?: string,
    kind: AppointmentKind = 'showroom',
  ): void {
    const office = this.office();
    if (!office) return;
    this.openDrawer({
      office,
      managers: this.officeManagers(),
      kind,
      date,
      time,
      defaultManagerId: managerId,
      appointments: this.items(),
    });
  }

  protected openCreateMeasurement(): void {
    this.openCreate(this.selectedDate(), '10:00', undefined, 'measurement');
  }

  protected openEdit(appointment: Appointment): void {
    const office = this.office();
    if (!office) return;
    this.openDrawer({
      office,
      managers: this.officeManagers(),
      appointment,
      appointments: this.items(),
    });
  }

  protected async openLead(lead: Lead): Promise<void> {
    const state: LeadDetailDrawerState = { dirty: false };
    const result = await firstValueFrom(
      this.dialogs
        .open<LeadDetailDrawer, LeadDetailDrawerData, LeadDetailDrawerResult>(LeadDetailDrawer, {
          data: { leadIds: [lead.id], initialLeadId: lead.id, state },
          panelClass: 'lead-detail-drawer-panel',
          backdropClass: 'lead-detail-drawer-backdrop',
          position: { top: '0', right: '0' },
          width: 'min(74rem, calc(100vw - 3rem))',
          height: '100dvh',
          maxWidth: '100vw',
          ariaLabelledBy: 'lead-drawer-title',
          autoFocus: 'dialog',
          enterAnimationDuration: 180,
          exitAnimationDuration: 140,
        })
        .afterClosed(),
    );
    if (result?.dirty || state.dirty) {
      this.leadsResource.reload();
      this.appointmentsResource.reload();
    }
  }

  protected appointmentsForSlot(
    date: string,
    slot: string,
    managerId: string,
  ): readonly Appointment[] {
    const [slotHour, slotMinute] = slot.split(':').map(Number);
    const slotStart = slotHour * 60 + slotMinute;
    return this.items().filter((appointment) => {
      if (
        !this.isTimelineAppointment(appointment) ||
        appointment.responsibleManager?.id !== managerId
      ) {
        return false;
      }
      const parts = officeDateTimeParts(
        appointment.startsAt,
        this.office()?.timezone_name ?? 'UTC',
      );
      const [hour, minute] = parts.time.split(':').map(Number);
      const start = hour * 60 + minute;
      return parts.date === date && Math.floor(start / 30) * 30 === slotStart;
    });
  }

  protected appointmentsForDay(date: string): readonly Appointment[] {
    const timeZone = this.office()?.timezone_name ?? 'UTC';
    return this.items()
      .filter(
        (appointment) =>
          this.isTimelineAppointment(appointment) &&
          officeDateTimeParts(appointment.startsAt, timeZone).date === date,
      )
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }

  protected visibleMonthAppointments(date: string): readonly Appointment[] {
    return this.appointmentsForDay(date).slice(0, MONTH_VISIBLE_APPOINTMENTS);
  }

  protected monthOverflowCount(date: string): number {
    return Math.max(0, this.appointmentsForDay(date).length - MONTH_VISIBLE_APPOINTMENTS);
  }

  protected isOutsideMonth(date: string): boolean {
    return date.slice(0, 7) !== startOfCalendarMonth(this.selectedDate()).slice(0, 7);
  }

  protected appointmentsForManager(managerId: string): readonly Appointment[] {
    return this.items().filter(
      (appointment) =>
        this.isTimelineAppointment(appointment) && appointment.responsibleManager?.id === managerId,
    );
  }

  protected localTime(instant: string): string {
    return officeDateTimeParts(instant, this.office()?.timezone_name ?? 'UTC').time;
  }

  protected appointmentHeight(appointment: Appointment): number {
    const minutes =
      (new Date(appointment.endsAt).getTime() - new Date(appointment.startsAt).getTime()) / 60_000;
    return Math.max(48, (minutes / 30) * 57.6 - 6);
  }

  protected appointmentStatusLabel(appointment: Appointment): string {
    switch (appointment.status) {
      case 'visited':
        return this.i18n.t('calendar.visited');
      case 'no_show':
        return this.i18n.t('calendar.noShow');
      case 'canceled':
        return this.i18n.t('calendar.canceled');
      case 'rescheduled':
        return this.i18n.t('calendar.rescheduled');
      case 'scheduled':
        return this.i18n.t('calendar.scheduled');
    }
  }

  protected appointmentStatusIcon(appointment: Appointment): UiIconName {
    switch (appointment.status) {
      case 'visited':
        return 'check_circle';
      case 'no_show':
        return 'warning';
      case 'canceled':
        return 'close';
      case 'scheduled':
        return appointment.kind === 'measurement' ? 'straighten' : 'calendar_month';
      default:
        return 'schedule';
    }
  }

  protected appointmentKindLabel(appointment: Appointment): string {
    return this.i18n.t(
      appointment.kind === 'measurement' ? 'calendar.kind.measurement' : 'calendar.kind.showroom',
    );
  }

  /**
   * Cards distinguish kind by colour and icon; this makes the same distinction
   * available to screen readers.
   */
  protected appointmentIconLabel(appointment: Appointment): string {
    return `${this.appointmentKindLabel(appointment)} · ${this.appointmentStatusLabel(appointment)}`;
  }

  protected slotLabel(date: string, time: string, manager: string): string {
    return this.i18n.t('calendar.addAt', { date, time, manager });
  }

  protected weekdayLabel(date: string): string {
    return new Intl.DateTimeFormat(this.intlLocale(), { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  }

  protected dayNumber(date: string): string {
    return String(Number(date.slice(8, 10)));
  }

  protected fullDateLabel(date: string): string {
    return new Intl.DateTimeFormat(this.intlLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  private monthLabel(date: string): string {
    return new Intl.DateTimeFormat(this.intlLocale(), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${startOfCalendarMonth(date)}T12:00:00Z`));
  }

  private shortDateLabel(date: string): string {
    return new Intl.DateTimeFormat(this.intlLocale(), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  }

  private availableOffices(): readonly Office[] {
    return this.session.officeContext()?.filterOffices ?? [];
  }

  private initialDate(): string {
    const office =
      this.availableOffices().find((item) => item.id === this.session.selectedOfficeId()) ??
      this.availableOffices()[0];
    return officeDateKey(new Date(), office?.timezone_name ?? 'UTC');
  }

  private rangeIncludesDate(date: string): boolean {
    const { from, to } = this.range();
    return date >= from && date < to;
  }

  private officeLabel(office: Office): string {
    return this.i18n.locale() === 'pl'
      ? office.name_pl
      : this.i18n.locale() === 'uk'
        ? office.name_uk
        : office.code === OFFICE_CONFIG.warsaw.id
          ? 'Warsaw'
          : 'Kyiv';
  }

  private intlLocale(): string {
    return this.i18n.locale() === 'uk' ? 'uk-UA' : this.i18n.locale() === 'pl' ? 'pl-PL' : 'en-GB';
  }

  private openDrawer(data: AppointmentDrawerData): void {
    const ref = openAppointmentDrawer(this.dialogs, data);
    ref.afterClosed().subscribe((result) => {
      if (result?.kind === 'saved' || result?.kind === 'stale') {
        this.appointmentsResource.reload();
      }
    });
  }

  private isTimelineAppointment(appointment: Appointment): boolean {
    return appointment.status !== 'rescheduled';
  }
}
