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

import type { Appointment } from '../../../core/api/generated/kolss-api.types';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SessionService } from '../../../core/session/session.service';
import type { Office } from '../../../models/database';
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
} from '../../../services/appointments.service';
import { commentDueAtForLead } from '../../../services/crm-mock.helpers';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiIcon, type UiIconName } from '../../../ui/icon/ui-icon';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import {
  LeadDetailDrawer,
  type LeadDetailDrawerData,
  type LeadDetailDrawerResult,
  type LeadDetailDrawerState,
} from '../leads/lead-detail-drawer';
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
  template: `
    <section class="calendar-page" aria-labelledby="calendar-title">
      <header class="page-header">
        <div>
          <p>{{ i18n.t('calendar.kicker') }}</p>
          <h1 id="calendar-title">{{ i18n.t('calendar.title') }}</h1>
        </div>
        <app-ui-button (pressed)="openCreate()">
          <app-ui-icon name="add" [size]="18" />
          {{ i18n.t('calendar.newAppointment') }}
        </app-ui-button>
      </header>

      <div class="toolbar" role="toolbar" [attr.aria-label]="i18n.t('calendar.controls')">
        <div class="date-navigation">
          <button
            type="button"
            class="icon-button"
            [attr.aria-label]="i18n.t('calendar.previous')"
            (click)="navigate(-1)"
          >
            <app-ui-icon name="chevron_left" [size]="22" />
          </button>
          <button type="button" class="today-button" (click)="goToday()">
            {{ i18n.t('calendar.today') }}
          </button>
          <button
            type="button"
            class="icon-button"
            [attr.aria-label]="i18n.t('calendar.next')"
            (click)="navigate(1)"
          >
            <app-ui-icon name="chevron_right" [size]="22" />
          </button>
          <strong>{{ rangeLabel() }}</strong>
        </div>

        <div class="toolbar-filters">
          @if (officeOptions().length > 1) {
            <app-ui-select
              class="compact-select"
              [label]="i18n.t('common.office')"
              [options]="officeOptions()"
              [value]="officeId()"
              (valueChange)="officeId.set($event)"
            />
          }
          <app-ui-select
            class="compact-select"
            [label]="i18n.t('common.manager')"
            [options]="managerOptions()"
            [value]="managerId()"
            (valueChange)="managerId.set($event)"
          />
          <div class="view-switch" [attr.aria-label]="i18n.t('calendar.view')">
            <button type="button" [class.is-active]="view() === 'day'" (click)="view.set('day')">
              {{ i18n.t('calendar.day') }}
            </button>
            <button type="button" [class.is-active]="view() === 'week'" (click)="view.set('week')">
              {{ i18n.t('calendar.week') }}
            </button>
            <button type="button" [class.is-active]="view() === 'month'" (click)="view.set('month')">
              {{ i18n.t('calendar.month') }}
            </button>
          </div>
        </div>
      </div>

      @if (view() === 'week' && sundayAppointments().length) {
        <button type="button" class="sunday-banner" (click)="openSunday()">
          <app-ui-icon name="info" [size]="18" />
          <span>
            {{ i18n.t('calendar.sundayBanner', { count: sundayAppointments().length }) }}
          </span>
          <app-ui-icon name="chevron_right" [size]="18" />
        </button>
      }

      @if (appointmentsResource.isLoading() || managersResource.isLoading()) {
        <div class="calendar-skeleton" aria-live="polite">
          <span></span><span></span><span></span><span></span>
        </div>
      } @else if (loadError()) {
        <div class="state-card" role="alert">
          <app-ui-icon name="error" [size]="24" />
          <strong>{{ i18n.t('calendar.loadFailed') }}</strong>
          <p>{{ loadError() }}</p>
          <app-ui-button variant="secondary" (pressed)="reload()">
            {{ i18n.t('calendar.retry') }}
          </app-ui-button>
        </div>
      } @else {
        @if (view() === 'day') {
          @if (dayReminders(selectedDate()).length) {
            <app-calendar-day-reminders
              class="day-reminders-banner desktop-calendar"
              [reminders]="dayReminders(selectedDate())"
              (leadSelected)="openLead($event)"
            />
          }
          <div
            ngGrid
            focusMode="roving"
            class="day-grid desktop-calendar"
            [attr.aria-label]="rangeLabel()"
          >
            <div ngGridRow class="grid-head">
              <div ngGridCell class="time-head">{{ office()?.timezone_name }}</div>
              @for (manager of visibleManagers(); track manager.id) {
                <div ngGridCell class="manager-head">
                  <strong>{{ manager.displayName }}</strong>
                  <small>{{ appointmentsForManager(manager.id).length }}</small>
                </div>
              }
            </div>
            @for (slot of timeSlots; track slot) {
              <div ngGridRow class="time-row">
                <div ngGridCell class="time-label">{{ slot }}</div>
                @for (manager of visibleManagers(); track manager.id) {
                  <div ngGridCell class="slot-cell">
                    <button
                      ngGridCellWidget
                      type="button"
                      class="slot-add"
                      [attr.aria-label]="slotLabel(selectedDate(), slot, manager.displayName)"
                      (click)="openCreate(selectedDate(), slot, manager.id)"
                    ></button>
                    @for (
                      appointment of appointmentsForSlot(selectedDate(), slot, manager.id);
                      track appointment.id
                    ) {
                      <button
                        ngGridCellWidget
                        type="button"
                        class="appointment-card"
                        [class.has-warning]="appointment.warnings.length"
                        [class.is-visited]="appointment.status === 'visited'"
                        [class.is-no-show]="appointment.status === 'no_show'"
                        [class.is-canceled]="appointment.status === 'canceled'"
                        [style.height.px]="appointmentHeight(appointment)"
                        (click)="openEdit(appointment)"
                      >
                        <time>{{ localTime(appointment.startsAt) }}</time>
                        <strong>{{ appointment.lead.name || appointment.lead.phone }}</strong>
                        @if (appointment.status !== 'scheduled') {
                          <app-ui-icon
                            class="appointment-status-icon"
                            [class.is-no-show]="appointment.status === 'no_show'"
                            [class.is-canceled]="appointment.status === 'canceled'"
                            [name]="appointmentStatusIcon(appointment)"
                            [size]="15"
                            [attr.aria-label]="appointmentStatusLabel(appointment)"
                          />
                        } @else if (appointment.warnings.length) {
                          <app-ui-icon name="warning" [size]="15" />
                        }
                        @if (appointment.comment; as comment) {
                          <small class="appointment-comment" [title]="comment">{{ comment }}</small>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        } @else if (view() === 'week') {
          <div
            ngGrid
            focusMode="roving"
            class="week-grid desktop-calendar"
            [attr.aria-label]="rangeLabel()"
          >
            <div ngGridRow class="week-head">
              @for (day of weekDays(); track day) {
                <div ngGridCell [class.is-today]="day === todayKey()">
                  <span>{{ weekdayLabel(day) }}</span>
                  <strong>{{ dayNumber(day) }}</strong>
                </div>
              }
            </div>
            <div ngGridRow class="week-columns">
              @for (day of weekDays(); track day) {
                <div ngGridCell class="week-day">
                  @if (dayReminders(day).length) {
                    <app-calendar-day-reminders
                      [reminders]="dayReminders(day)"
                      (leadSelected)="openLead($event)"
                    />
                  }
                  <button
                    ngGridCellWidget
                    type="button"
                    class="week-add"
                    (click)="openCreate(day, '10:00')"
                  >
                    <app-ui-icon name="add" [size]="16" />
                    {{ i18n.t('calendar.add') }}
                  </button>
                  @for (appointment of appointmentsForDay(day); track appointment.id) {
                    <button
                      ngGridCellWidget
                      type="button"
                      class="week-card"
                      [class.has-warning]="appointment.warnings.length"
                      [class.is-visited]="appointment.status === 'visited'"
                      [class.is-no-show]="appointment.status === 'no_show'"
                      [class.is-canceled]="appointment.status === 'canceled'"
                      (click)="openEdit(appointment)"
                    >
                      <span>
                        <time>{{ localTime(appointment.startsAt) }}</time>
                        @if (appointment.warnings.length) {
                          <app-ui-icon name="warning" [size]="14" />
                        }
                      </span>
                      <strong>{{ appointment.lead.name || appointment.lead.phone }}</strong>
                      @if (appointment.status !== 'scheduled') {
                        <small
                          class="appointment-status"
                          [class.is-no-show]="appointment.status === 'no_show'"
                          [class.is-canceled]="appointment.status === 'canceled'"
                        >
                          <app-ui-icon [name]="appointmentStatusIcon(appointment)" [size]="14" />
                          {{ appointmentStatusLabel(appointment) }}
                        </small>
                      }
                      <small>{{
                        appointment.responsibleManager?.displayName ?? i18n.t('common.noManager')
                      }}</small>
                      @if (appointment.comment; as comment) {
                        <small class="appointment-comment" [title]="comment">{{ comment }}</small>
                      }
                    </button>
                  } @empty {
                    <p class="empty-day">{{ i18n.t('calendar.freeDay') }}</p>
                  }
                </div>
              }
            </div>
          </div>
        } @else {
          <div
            ngGrid
            focusMode="roving"
            class="month-grid desktop-calendar"
            [attr.aria-label]="rangeLabel()"
          >
            <div ngGridRow class="month-head">
              @for (day of monthWeekdayHeaders(); track day) {
                <div ngGridCell>{{ weekdayLabel(day) }}</div>
              }
            </div>
            @for (week of monthWeeks(); track week[0]) {
              <div ngGridRow class="month-week">
                @for (day of week; track day) {
                  <div
                    ngGridCell
                    class="month-day"
                    [class.is-today]="day === todayKey()"
                    [class.is-outside]="isOutsideMonth(day)"
                  >
                    <div class="month-day-header">
                      <button
                        ngGridCellWidget
                        type="button"
                        class="month-day-number"
                        [attr.aria-label]="fullDateLabel(day)"
                        (click)="openDay(day)"
                      >
                        {{ dayNumber(day) }}
                      </button>
                      <button
                        ngGridCellWidget
                        type="button"
                        class="month-add"
                        [attr.aria-label]="i18n.t('calendar.add')"
                        (click)="openCreate(day, '10:00')"
                      >
                        <app-ui-icon name="add" [size]="14" />
                      </button>
                    </div>
                    @if (dayReminders(day).length) {
                      <app-calendar-day-reminders
                        [reminders]="dayReminders(day)"
                        (leadSelected)="openLead($event)"
                      />
                    }
                    @for (
                      appointment of visibleMonthAppointments(day);
                      track appointment.id
                    ) {
                      <button
                        ngGridCellWidget
                        type="button"
                        class="month-card"
                        [class.has-warning]="appointment.warnings.length"
                        [class.is-visited]="appointment.status === 'visited'"
                        [class.is-no-show]="appointment.status === 'no_show'"
                        [class.is-canceled]="appointment.status === 'canceled'"
                        (click)="openEdit(appointment)"
                      >
                        <time>{{ localTime(appointment.startsAt) }}</time>
                        <strong>{{ appointment.lead.name || appointment.lead.phone }}</strong>
                        @if (appointment.status !== 'scheduled') {
                          <app-ui-icon
                            class="appointment-status-icon"
                            [class.is-no-show]="appointment.status === 'no_show'"
                            [class.is-canceled]="appointment.status === 'canceled'"
                            [name]="appointmentStatusIcon(appointment)"
                            [size]="12"
                            [attr.aria-label]="appointmentStatusLabel(appointment)"
                          />
                        } @else if (appointment.warnings.length) {
                          <app-ui-icon name="warning" [size]="12" />
                        }
                      </button>
                    }
                    @if (monthOverflowCount(day); as overflow) {
                      <button
                        ngGridCellWidget
                        type="button"
                        class="month-more"
                        (click)="openDay(day)"
                      >
                        {{ i18n.t('calendar.moreCount', { count: overflow }) }}
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="mobile-agenda">
          @for (group of agendaGroups(); track group.date) {
            <section>
              <h2>{{ fullDateLabel(group.date) }}</h2>
              @if (dayReminders(group.date).length) {
                <app-calendar-day-reminders
                  class="agenda-reminders"
                  [reminders]="dayReminders(group.date)"
                  (leadSelected)="openLead($event)"
                />
              }
              @for (appointment of group.items; track appointment.id) {
                <button
                  type="button"
                  class="agenda-card"
                  [class.has-warning]="appointment.warnings.length"
                  [class.is-visited]="appointment.status === 'visited'"
                  [class.is-no-show]="appointment.status === 'no_show'"
                  [class.is-canceled]="appointment.status === 'canceled'"
                  (click)="openEdit(appointment)"
                >
                  <time>{{ localTime(appointment.startsAt) }}</time>
                  <span>
                    <strong>{{ appointment.lead.name || appointment.lead.phone }}</strong>
                    <small>{{
                      appointment.responsibleManager?.displayName ?? i18n.t('common.noManager')
                    }}</small>
                    @if (appointment.comment; as comment) {
                      <small class="appointment-comment" [title]="comment">{{ comment }}</small>
                    }
                    @if (appointment.status !== 'scheduled') {
                      <small
                        class="appointment-status"
                        [class.is-no-show]="appointment.status === 'no_show'"
                        [class.is-canceled]="appointment.status === 'canceled'"
                      >
                        {{ appointmentStatusLabel(appointment) }}
                      </small>
                    }
                  </span>
                  <span class="agenda-trailing">
                    @if (appointment.warnings.length) {
                      <app-ui-icon
                        class="warning"
                        name="warning"
                        [size]="16"
                        [attr.aria-label]="i18n.t('calendar.hasWarning')"
                      />
                    }
                    <app-ui-icon name="chevron_right" [size]="18" />
                  </span>
                </button>
              } @empty {
                <p class="agenda-empty">{{ i18n.t('calendar.noAppointments') }}</p>
              }
            </section>
          }
        </div>
      }
    </section>
  `,
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
      if (!params.officeId) return Promise.resolve([] as readonly MockLead[]);
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
        manager.role === 'office_member' &&
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
   * cards. Honors the toolbar manager filter; office is already scoped by the
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
      if (selectedManager !== 'all' && lead.assignedToId !== selectedManager) continue;

      if (lead.callStatus === 'callback_requested' && lead.callbackDueAt) {
        push({
          kind: 'callback',
          date: officeDateTimeParts(lead.callbackDueAt, timeZone).date,
          lead,
        });
      }

      const commentDueAt = commentDueAtForLead(lead);
      if (commentDueAt) {
        push({ kind: 'comment', date: officeDateTimeParts(commentDueAt, timeZone).date, lead });
      }
    }

    return byDate;
  });

  protected dayReminders(date: string): readonly CalendarReminder[] {
    return this.remindersByDate().get(date) ?? EMPTY_REMINDERS;
  }

  protected readonly agendaGroups = computed(() => {
    if (this.view() === 'day') {
      return [{ date: this.selectedDate(), items: this.appointmentsForDay(this.selectedDate()) }];
    }
    if (this.view() === 'month') {
      const monthStart = startOfCalendarMonth(this.selectedDate());
      const nextMonth = addCalendarMonths(monthStart, 1);
      const groups: { date: string; items: readonly Appointment[] }[] = [];
      for (
        let date = monthStart;
        date < nextMonth;
        date = addCalendarDays(date, 1)
      ) {
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

  protected openCreate(date = this.selectedDate(), time = '10:00', managerId?: string): void {
    const office = this.office();
    if (!office) return;
    this.openDrawer({
      office,
      managers: this.officeManagers(),
      date,
      time,
      defaultManagerId: managerId,
      appointments: this.items(),
    });
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

  protected async openLead(lead: MockLead): Promise<void> {
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
      default:
        return 'schedule';
    }
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
        : office.code === 'warsaw'
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
