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
import type { MessageKey } from '@core/i18n/messages';
import { isOfficeId, OFFICE_CONFIG } from '@core/office/office.config';
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
  OVERDUE_LOOKBACK_DAYS,
  overdueAppointmentWindows,
  parseCalendarAppointmentQuery,
  startOfCalendarMonth,
} from '@services/appointments.service';
import { activeRemindersForLead, commentAssigneeForLead } from '@domain/lead.rules';
import type { Lead } from '@domain/lead.types';
import type { OfficeId } from '@domain/office.types';
import { LeadsService } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { UiButton } from '@ui/button/ui-button';
import { UiChip } from '@ui/feedback/ui-chip';
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
import { CalendarOverdueList, type CalendarOverdueRow } from './calendar-overdue-list';
import {
  CALENDAR_REMINDER_FILTER_KIND_MAP,
  parseCalendarPageQuery,
  serializeCalendarPageQuery,
  type CalendarReminderFilterKind,
} from './calendar-page-query-params';

type CalendarView = 'day' | 'week' | 'month';

const MONTH_VISIBLE_APPOINTMENTS = 3;
const EMPTY_REMINDERS: readonly CalendarReminder[] = [];
const EMPTY_OVERDUE_ROWS: readonly CalendarOverdueRow[] = [];

@Component({
  selector: 'app-calendar-page',
  imports: [
    Grid,
    GridCell,
    GridCellWidget,
    GridRow,
    UiButton,
    UiChip,
    UiIcon,
    UiSelect,
    CalendarDayReminders,
    CalendarOverdueList,
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

  /**
   * The morning digest's deep link (`office`/`date`/`kind`/`due`) — unlike
   * `incomingDeepLink` above, this one is *not* consumed-and-wiped: it stays
   * shareable via the persistent URL-sync effect below, so it must be read
   * from a separate param set that the appointment deep link's one-shot
   * clear (`queryParams: {}`) never needs to touch.
   */
  private readonly linkedReminderQuery = parseCalendarPageQuery(this.route.snapshot.queryParamMap);
  private linkedReminderOfficeApplied = false;

  protected readonly view = signal<CalendarView>(
    !this.linkedReminderQuery?.due && this.linkedReminderQuery?.date ? 'day' : 'week',
  );
  protected readonly officeId = linkedSignal(
    () => this.session.selectedOfficeId() ?? this.availableOffices()[0]?.id ?? '',
  );
  protected readonly managerId = linkedSignal(() => {
    this.officeId();
    return 'all';
  });
  protected readonly selectedDate = signal(
    this.incomingDeepLink?.date ?? this.linkedReminderQuery?.date ?? this.initialDate(),
  );
  /** Business reminder group (`callback`/`visit`/`reminder`) from the digest link, if any. */
  protected readonly reminderKindFilter = signal<CalendarReminderFilterKind | null>(
    this.linkedReminderQuery?.due ? null : (this.linkedReminderQuery?.kind ?? null),
  );
  /** `due=overdue` — every unfinished reminder due before today, any kind, any day. */
  protected readonly overdueMode = signal(this.linkedReminderQuery?.due ?? false);
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

    // Offices arrive from `/v1/me`, so a linked office can only be applied
    // once the session context is loaded. An office the user cannot see is
    // ignored: the rest of the link still applies.
    effect(() => {
      const office = this.linkedReminderQuery?.office;
      const context = this.session.officeContext();
      if (!office || this.linkedReminderOfficeApplied || !this.session.loaded() || !context) return;

      this.linkedReminderOfficeApplied = true;
      if (!context.canFilter) return;
      if (!context.filterOffices.some((entry) => entry.code === office)) return;
      untracked(() => this.session.setOfficeFilter(office));
    });

    // Keeps the digest's filter/office state in the address bar so the
    // filtered view stays shareable and survives a reload — unlike the
    // one-shot appointment deep link above, this effect keeps re-writing the
    // URL as the user paginates through days or clears the filter.
    effect(() => {
      const queryParams = serializeCalendarPageQuery({
        office: this.session.showOfficeFilter() ? this.officeCode() : null,
        date: this.reminderKindFilter() ? this.selectedDate() : null,
        kind: this.reminderKindFilter(),
        due: this.overdueMode(),
      });
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
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
  /**
   * `due=overdue` needs "any day up to (not incl.) today" instead of the
   * navigation-bound day/week/month window, since a forgotten visit can be
   * arbitrarily far in the past — the normal views never need to see it.
   */
  /**
   * `due=overdue` needs "any day up to (not incl.) today" instead of the
   * navigation-bound day/week/month window, since a forgotten visit can be
   * arbitrarily far in the past — the normal views never need to see it.
   * `OVERDUE_LOOKBACK_DAYS` deliberately mirrors the digest's own overdue
   * window (`internal/leadcohorts`) so the count and this list agree.
   */
  private readonly range = computed(() => {
    if (this.overdueMode()) {
      return {
        from: addCalendarDays(this.todayKey(), -OVERDUE_LOOKBACK_DAYS),
        to: this.todayKey(),
      };
    }
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
  /**
   * Under `due=overdue`, the year-wide `range` above is fetched as several
   * ≤60-day windows, each requesting `status: 'scheduled'` server-side —
   * `GET /v1/appointments` hard-rejects any single request spanning more
   * than 63 days (`internal/crmapi/appointments.go`), and a year is far past
   * that. `overdueReminders` still re-checks `status === 'scheduled'`
   * defensively rather than trust the request param blindly. The normal
   * day/week/month grid is untouched: one request, every status, same as
   * before.
   */
  protected readonly appointmentsResource = resource({
    params: () => ({
      officeId: this.officeId(),
      ...this.range(),
      managerId: this.managerId() === 'all' ? undefined : this.managerId(),
      overdue: this.overdueMode(),
    }),
    loader: async ({ params }) => {
      const { officeId, from, to, managerId } = params;
      if (!officeId) {
        return { items: [], timezone: 'UTC', from, to };
      }
      if (!params.overdue) {
        return this.appointments.list({ officeId, from, to, managerId });
      }
      const responses = await Promise.all(
        overdueAppointmentWindows(to).map((window) =>
          this.appointments.list({
            officeId,
            from: window.from,
            to: window.to,
            managerId,
            status: 'scheduled',
          }),
        ),
      );
      return {
        items: responses.flatMap((response) => response.items),
        timezone: responses[0]?.timezone ?? 'UTC',
        from,
        to,
      };
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
   * Date-only lead reminders (blue callbacks, teal "thinking", grey "postponed",
   * orange comment follow-ups) bucketed by office day — one entry per active
   * reminder, never grouped by lead, so a lead with e.g. both a `thinking` and a
   * `comment` reminder due the same day contributes two chips. Showroom/measurement due
   * dates are excluded — they render as appointment cards instead (see
   * `appointmentsForDay`). `activeRemindersForLead` already drops closed
   * leads. Honors the toolbar manager filter; office is already scoped by the
   * loaded resource.
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
      const assigneeId = commentAssigneeForLead(lead);
      if (
        selectedManager !== 'all' &&
        lead.assignedToId !== selectedManager &&
        assigneeId !== selectedManager
      ) {
        continue;
      }

      for (const reminder of activeRemindersForLead(lead)) {
        if (reminder.kind === 'showroom' || reminder.kind === 'measurement') continue;
        const date = officeDateTimeParts(reminder.dueAt, timeZone).date;
        if (reminder.kind === 'comment' && assigneeId) {
          push({
            kind: 'comment',
            date,
            lead,
            assigneeId,
            assigneeName: this.employeeName(assigneeId),
          });
        } else {
          push({ kind: reminder.kind, date, lead });
        }
      }
    }

    return byDate;
  });

  /** Applies the digest's business-group filter (`callback`/`visit`/`reminder`), if any. */
  protected dayReminders(date: string): readonly CalendarReminder[] {
    const reminders = this.remindersByDate().get(date) ?? EMPTY_REMINDERS;
    const filterKind = this.reminderKindFilter();
    if (!filterKind) return reminders;
    const allowed = CALENDAR_REMINDER_FILTER_KIND_MAP[filterKind];
    return reminders.filter((reminder) => allowed.includes(reminder.kind));
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
        !reminder.assigneeId || reminder.kind !== 'comment' || !columnIds.has(reminder.assigneeId),
    );
  }

  /** Date-only tasks for a manager's day column all-day strip. */
  protected dayColumnTasks(date: string, managerId: string): readonly CalendarReminder[] {
    return this.dayReminders(date).filter(
      (reminder) => reminder.kind === 'comment' && reminder.assigneeId === managerId,
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

  /**
   * `due=overdue` rows: every unfinished reminder due strictly before today
   * and no more than `OVERDUE_LOOKBACK_DAYS` days ago, across all days — one
   * row per reminder, never grouped by lead. Independent of `selectedDate`.
   * Callback/thinking/comment come from `leadsResource`
   * (`activeRemindersForLead`), which loads every active lead regardless of
   * date — so unlike the appointments branch below (bounded by the windowed
   * request range), this one needs its own explicit lower bound, or a
   * comment reminder from over a year ago would outlive the digest's own
   * `internal/leadcohorts` cutoff and inflate this list past the count the
   * digest reported. Showroom/measurement come from `appointmentsResource`
   * instead, filtered to `status === 'scheduled'` — a visit already marked
   * visited/canceled/no-show is not overdue, it's done, matching the
   * digest's `lead_showroom_visits.status = 'scheduled'` rule. The status
   * check here is a defensive re-check: `appointmentsResource` already
   * requests `status: 'scheduled'` server-side while overdue mode is on (see
   * `appointmentsResource` above), this just doesn't blindly trust it.
   */
  protected readonly overdueReminders = computed<readonly CalendarOverdueRow[]>(() => {
    if (!this.overdueMode()) return EMPTY_OVERDUE_ROWS;

    const leads = this.leadsResource.value() ?? [];
    const leadById = new Map(leads.map((lead) => [lead.id, lead] as const));
    const timeZone = this.office()?.timezone_name ?? 'UTC';
    const today = this.todayKey();
    const earliestOverdueDate = addCalendarDays(today, -OVERDUE_LOOKBACK_DAYS);
    const selectedManager = this.managerId();
    const rows: CalendarOverdueRow[] = [];

    for (const lead of leads) {
      const assigneeId = commentAssigneeForLead(lead);
      if (
        selectedManager !== 'all' &&
        lead.assignedToId !== selectedManager &&
        assigneeId !== selectedManager
      ) {
        continue;
      }

      for (const reminder of activeRemindersForLead(lead)) {
        // showroom/measurement are sourced from appointments below instead —
        // that's the status-aware source of truth, not the lead's derived
        // due-date fields.
        if (reminder.kind === 'showroom' || reminder.kind === 'measurement') continue;
        const parts = officeDateTimeParts(reminder.dueAt, timeZone);
        if (parts.date >= today || parts.date < earliestOverdueDate) continue;
        rows.push({
          kind: reminder.kind,
          lead,
          dateLabel: this.shortDateLabel(parts.date),
          timeLabel: parts.time,
          assigneeName:
            reminder.kind === 'comment' && assigneeId ? this.employeeName(assigneeId) : null,
          dueAt: reminder.dueAt,
        });
      }
    }

    for (const appointment of this.items()) {
      if (appointment.status !== 'scheduled') continue;
      if (selectedManager !== 'all' && appointment.responsibleManager?.id !== selectedManager) {
        continue;
      }
      const parts = officeDateTimeParts(appointment.startsAt, timeZone);
      if (parts.date >= today) continue;
      const lead = leadById.get(appointment.lead.id);
      if (!lead) continue;
      rows.push({
        kind: appointment.kind,
        lead,
        dateLabel: this.shortDateLabel(parts.date),
        timeLabel: parts.time,
        assigneeName: null,
        dueAt: appointment.startsAt,
      });
    }

    return rows.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  });

  protected readonly overdueLoadError = computed(() => {
    const error =
      this.leadsResource.error() ??
      this.managersResource.error() ??
      this.appointmentsResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  /** Localized name of a digest business group, for the active-filter chip. */
  protected filterGroupLabel(kind: CalendarReminderFilterKind): string {
    return this.i18n.t(`calendar.filter.${kind}` as MessageKey);
  }

  /** How many rows are currently shown for the active filter — must match the digest's count. */
  protected filteredReminderCount(): number {
    const kind = this.reminderKindFilter();
    if (!kind) return 0;
    if (kind === 'visit') return this.appointmentsForDay(this.selectedDate()).length;
    return this.dayReminders(this.selectedDate()).length;
  }

  protected clearReminderFilter(): void {
    this.reminderKindFilter.set(null);
  }

  protected exitOverdueMode(): void {
    this.overdueMode.set(false);
    this.selectedDate.set(this.todayKey());
    this.view.set('week');
  }

  private officeCode(): OfficeId | null {
    const code = this.office()?.code;
    return isOfficeId(code) ? code : null;
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
        appointment.responsibleManager?.id !== managerId ||
        !this.isVisibleUnderVisitFilter(appointment)
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
          this.isVisibleUnderVisitFilter(appointment) &&
          officeDateTimeParts(appointment.startsAt, timeZone).date === date,
      )
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }

  /**
   * Under a `kind=visit` deep link, only still-scheduled visits count toward
   * "Візити в салон" — matches the digest's `lead_showroom_visits.status =
   * 'scheduled'` rule, so a visit already visited/canceled/no-show doesn't
   * inflate the count past what the digest reported. Filtered client-side
   * (not via the request) because the deep link's `date` always falls inside
   * whatever day/week/month range is already loaded, so the data is already
   * there — narrowing the request would only add a redundant round-trip.
   * Normal (unfiltered) browsing is untouched: every status still renders.
   */
  private isVisibleUnderVisitFilter(appointment: Appointment): boolean {
    return this.reminderKindFilter() !== 'visit' || appointment.status === 'scheduled';
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
