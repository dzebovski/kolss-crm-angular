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

import type { Appointment } from '../../../core/api/generated/kolss-api.types';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SessionService } from '../../../core/session/session.service';
import type { Office } from '../../../models/database';
import {
  addCalendarDays,
  AppointmentsService,
  type CalendarAppointmentDeepLink,
  officeDateKey,
  officeDateTimeParts,
  parseCalendarAppointmentQuery,
} from '../../../services/appointments.service';
import { UsersService } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiIcon, type UiIconName } from '../../../ui/icon/ui-icon';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { openAppointmentDrawer, type AppointmentDrawerData } from './appointment-drawer';

type CalendarView = 'day' | 'week';

@Component({
  selector: 'app-calendar-page',
  imports: [Grid, GridCell, GridCellWidget, GridRow, UiButton, UiIcon, UiSelect],
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
        } @else {
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
        }

        <div class="mobile-agenda">
          @for (group of agendaGroups(); track group.date) {
            <section>
              <h2>{{ fullDateLabel(group.date) }}</h2>
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
  styles: `
    .calendar-page {
      display: grid;
      gap: var(--ui-space-4);
      min-width: 0;
    }

    .page-header,
    .toolbar,
    .date-navigation,
    .toolbar-filters,
    .view-switch {
      display: flex;
      align-items: center;
    }

    .page-header {
      justify-content: space-between;
      gap: var(--ui-space-4);
    }

    .page-header p {
      margin: 0 0 var(--ui-space-1);
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font: 720 2rem/1.1 var(--ui-font-display);
    }

    .toolbar {
      min-height: 4.5rem;
      padding: var(--ui-space-3);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      justify-content: space-between;
      gap: var(--ui-space-4);
      box-shadow: var(--ui-shadow-1);
    }

    .date-navigation,
    .toolbar-filters {
      gap: var(--ui-space-2);
    }

    .date-navigation strong {
      min-width: 13rem;
      margin-left: var(--ui-space-2);
      font-family: var(--ui-font-display);
    }

    .icon-button,
    .today-button,
    .view-switch button {
      min-height: 2.4rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      color: inherit;
      cursor: pointer;
    }

    .icon-button {
      width: 2.4rem;
      display: grid;
      place-items: center;
    }

    .today-button {
      padding-inline: var(--ui-space-3);
      font-weight: 650;
    }

    .view-switch {
      padding: 0.2rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-muted);
    }

    .view-switch button {
      border: 0;
      min-height: 2rem;
      padding-inline: var(--ui-space-3);
      background: transparent;
      font-weight: 650;
    }

    .view-switch button.is-active {
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
    }

    .compact-select {
      width: 12rem;
    }

    .sunday-banner {
      width: 100%;
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid color-mix(in srgb, var(--ui-warning) 30%, var(--ui-border));
      border-radius: var(--ui-radius-md);
      background: color-mix(in srgb, var(--ui-warning) 8%, var(--ui-surface-raised));
      color: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      text-align: left;
    }

    .sunday-banner span {
      flex: 1;
    }

    .day-grid,
    .week-grid {
      min-width: 55rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: auto;
    }

    .grid-head,
    .time-row {
      display: grid;
      grid-template-columns: 4.5rem repeat(var(--manager-count, 1), minmax(10rem, 1fr));
    }

    .grid-head {
      position: sticky;
      top: 0;
      z-index: 3;
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-raised);
    }

    .time-head,
    .manager-head,
    .time-label,
    .slot-cell {
      border-right: 1px solid var(--ui-border);
    }

    .time-head,
    .manager-head {
      min-height: 3.75rem;
      padding: var(--ui-space-3);
      display: grid;
      align-content: center;
    }

    .time-head,
    .manager-head small {
      color: var(--ui-text-subtle);
      font-size: 0.7rem;
    }

    .manager-head {
      gap: 0.15rem;
    }

    .time-row {
      min-height: 3.6rem;
      border-bottom: 1px solid var(--ui-border);
    }

    .time-row:nth-child(odd) .slot-cell {
      background: color-mix(in srgb, var(--ui-surface-muted) 42%, transparent);
    }

    .time-label {
      padding: var(--ui-space-2);
      color: var(--ui-text-subtle);
      font-size: 0.72rem;
      text-align: right;
    }

    .slot-cell {
      position: relative;
      min-width: 0;
      padding: 0.2rem;
    }

    .slot-cell:has(.appointment-card) {
      z-index: 2;
    }

    .slot-add {
      position: absolute;
      inset: 0;
      width: 100%;
      border: 0;
      background: transparent;
      cursor: crosshair;
    }

    .appointment-card,
    .week-card {
      position: relative;
      z-index: 1;
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--ui-action) 30%, var(--ui-border));
      border-left: 3px solid var(--ui-action);
      border-radius: var(--ui-radius-sm);
      background: color-mix(in srgb, var(--ui-action) 8%, var(--ui-surface-raised));
      color: inherit;
      cursor: pointer;
      text-align: left;
    }

    .appointment-card {
      position: absolute;
      inset: 0.2rem 0.2rem auto;
      min-height: 3rem;
      padding: 0.35rem 0.45rem;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.35rem;
    }

    .appointment-card time,
    .week-card time {
      color: var(--ui-action);
      font-size: 0.72rem;
      font-weight: 750;
    }

    .appointment-card strong {
      overflow: hidden;
      font-size: 0.78rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .appointment-comment {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .appointment-card .appointment-comment {
      grid-column: 1 / -1;
    }

    .has-warning {
      border-left-color: var(--ui-warning);
    }

    .is-visited {
      border-left-color: var(--ui-success);
      background: var(--ui-success-soft);
    }

    .appointment-card.is-no-show,
    .week-card.is-no-show,
    .agenda-card.is-no-show {
      border-left-color: var(--ui-warning);
      background: var(--ui-warning-soft);
    }

    .appointment-card.is-canceled,
    .week-card.is-canceled,
    .agenda-card.is-canceled {
      border-left-color: var(--ui-danger);
      background: var(--ui-danger-soft);
    }

    .is-visited time,
    .appointment-status,
    .appointment-status-icon {
      color: var(--ui-success);
    }

    .is-no-show time,
    .appointment-status.is-no-show,
    .appointment-status-icon.is-no-show {
      color: var(--ui-warning);
    }

    .is-canceled time,
    .appointment-status.is-canceled,
    .appointment-status-icon.is-canceled {
      color: var(--ui-danger);
    }

    .week-head,
    .week-columns {
      display: grid;
      grid-template-columns: repeat(6, minmax(9rem, 1fr));
    }

    .week-head > div {
      min-height: 4.5rem;
      padding: var(--ui-space-3);
      border-right: 1px solid var(--ui-border);
      border-bottom: 1px solid var(--ui-border);
      display: grid;
      gap: 0.2rem;
    }

    .week-head span {
      color: var(--ui-text-subtle);
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .week-head strong {
      font-size: 1.25rem;
    }

    .week-head .is-today strong {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--ui-action);
      color: white;
      display: grid;
      place-items: center;
    }

    .week-day {
      min-height: 34rem;
      padding: var(--ui-space-2);
      border-right: 1px solid var(--ui-border);
      display: grid;
      align-content: start;
      gap: var(--ui-space-2);
    }

    .week-add {
      min-height: 2.25rem;
      border: 1px dashed var(--ui-border-strong);
      border-radius: var(--ui-radius-sm);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--ui-space-1);
    }

    .week-card {
      padding: var(--ui-space-3);
      display: grid;
      gap: 0.25rem;
    }

    .week-card > span {
      display: flex;
      justify-content: space-between;
    }

    .week-card strong {
      font-size: 0.82rem;
    }

    .week-card small,
    .empty-day {
      color: var(--ui-text-muted);
      font-size: 0.72rem;
    }

    .empty-day {
      margin: var(--ui-space-5) 0;
      text-align: center;
    }

    .calendar-skeleton {
      min-height: 32rem;
      padding: var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--ui-space-3);
    }

    .calendar-skeleton span {
      border-radius: var(--ui-radius-md);
      background: linear-gradient(
        90deg,
        var(--ui-surface-muted),
        var(--ui-surface-subtle),
        var(--ui-surface-muted)
      );
      background-size: 200% 100%;
      animation: shimmer 1.2s infinite;
    }

    .state-card {
      min-height: 22rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--ui-space-2);
      text-align: center;
    }

    .state-card p {
      max-width: 32rem;
      color: var(--ui-text-muted);
    }

    .mobile-agenda {
      display: none;
    }

    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }

    @media (max-width: 860px) {
      .toolbar,
      .page-header {
        align-items: stretch;
        flex-direction: column;
      }

      .toolbar-filters {
        flex-wrap: wrap;
      }

      .compact-select {
        flex: 1 1 12rem;
        width: auto;
      }

      .desktop-calendar {
        display: none;
      }

      .mobile-agenda {
        display: grid;
        gap: var(--ui-space-4);
      }

      .mobile-agenda section {
        padding: var(--ui-space-3);
        border: 1px solid var(--ui-border);
        border-radius: var(--ui-radius-lg);
        background: var(--ui-surface-raised);
      }

      .mobile-agenda h2 {
        margin: 0 0 var(--ui-space-3);
        font: 700 1rem/1.2 var(--ui-font-display);
      }

      .agenda-card {
        width: 100%;
        padding: var(--ui-space-3);
        border: 0;
        border-left: 3px solid var(--ui-action);
        border-radius: var(--ui-radius-sm);
        background: var(--ui-surface-muted);
        color: inherit;
        display: grid;
        grid-template-columns: 3.5rem 1fr auto;
        align-items: center;
        gap: var(--ui-space-3);
        text-align: left;
      }

      .agenda-card + .agenda-card {
        margin-top: var(--ui-space-2);
      }

      .agenda-card time {
        color: var(--ui-action);
        font-weight: 750;
      }

      .agenda-card span {
        display: grid;
      }

      .agenda-card .agenda-trailing {
        display: flex;
        align-items: center;
        gap: var(--ui-space-1);
      }

      .agenda-card .warning {
        color: var(--ui-warning);
      }

      .agenda-card small,
      .agenda-empty {
        color: var(--ui-text-muted);
      }
    }

    @media (max-width: 520px) {
      h1 {
        font-size: 1.55rem;
      }

      .date-navigation {
        flex-wrap: wrap;
      }

      .date-navigation strong {
        min-width: 100%;
        margin: var(--ui-space-2) 0 0;
      }

      .view-switch {
        width: 100%;
      }

      .view-switch button {
        flex: 1;
      }
    }
  `,
  host: {
    '[style.--manager-count]': 'visibleManagers().length || 1',
  },
})
export class CalendarPage {
  protected readonly i18n = inject(I18nService);
  private readonly session = inject(SessionService);
  private readonly appointments = inject(AppointmentsService);
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
  protected readonly weekStart = computed(() => this.mondayFor(this.selectedDate()));
  protected readonly weekDays = computed(() =>
    Array.from({ length: 6 }, (_, index) => addCalendarDays(this.weekStart(), index)),
  );
  private readonly range = computed(() => {
    if (this.view() === 'day') {
      return { from: this.selectedDate(), to: addCalendarDays(this.selectedDate(), 1) };
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

  protected readonly items = computed(() => this.appointmentsResource.value()?.items ?? []);
  protected readonly managers = computed(() => this.managersResource.value() ?? []);
  protected readonly visibleManagers = computed(() => {
    const managers = this.managers().filter((manager) =>
      manager.officeUuids.includes(this.officeId()),
    );
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
    ...this.managers()
      .filter((manager) => manager.officeUuids.includes(this.officeId()))
      .map((manager) => ({
        value: manager.id,
        label: manager.displayName,
        userId: manager.id,
      })),
  ]);
  protected readonly sundayAppointments = computed(() => {
    if (this.view() !== 'week') return [];
    return this.appointmentsForDay(addCalendarDays(this.weekStart(), 6));
  });
  protected readonly agendaGroups = computed(() => {
    const days = this.view() === 'day' ? [this.selectedDate()] : this.weekDays();
    return days.map((date) => ({ date, items: this.appointmentsForDay(date) }));
  });
  protected readonly loadError = computed(() => {
    const error = this.appointmentsResource.error() ?? this.managersResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });
  protected readonly rangeLabel = computed(() => {
    if (this.view() === 'day') return this.fullDateLabel(this.selectedDate());
    const start = this.weekStart();
    const end = addCalendarDays(start, 5);
    return `${this.shortDateLabel(start)} — ${this.shortDateLabel(end)}`;
  });

  protected navigate(direction: number): void {
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

  protected reload(): void {
    this.appointmentsResource.reload();
    this.managersResource.reload();
  }

  protected openCreate(date = this.selectedDate(), time = '10:00', managerId?: string): void {
    const office = this.office();
    if (!office) return;
    this.openDrawer({
      office,
      managers: this.managers(),
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
      managers: this.managers(),
      appointment,
      appointments: this.items(),
    });
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

  private mondayFor(date: string): string {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    return addCalendarDays(date, weekday === 0 ? -6 : 1 - weekday);
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
