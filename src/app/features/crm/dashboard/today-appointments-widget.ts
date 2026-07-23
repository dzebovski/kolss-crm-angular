import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../../core/i18n/i18n.service';
import { SessionService } from '../../../core/session/session.service';
import type { Appointment } from '../../../core/api/generated/kolss-api.types';
import type { Office } from '../../../models/database';
import {
  addCalendarDays,
  AppointmentsService,
  officeDateKey,
  officeDateTimeParts,
} from '../../../services/appointments.service';
import type { CrmEmployee } from '../../../services/users.service';
import { UsersService } from '../../../services/users.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { openAppointmentDrawer } from '../calendar/appointment-drawer';

interface OfficeAppointmentGroup {
  readonly office: Office;
  readonly items: readonly Appointment[];
}

@Component({
  selector: 'app-today-appointments-widget',
  imports: [RouterLink, UiButton, UiIcon],
  template: `
    <section class="today-widget" aria-labelledby="today-appointments-title">
      <header>
        <div>
          <p>{{ i18n.t('calendar.dashboardKicker') }}</p>
          <h2 id="today-appointments-title">{{ i18n.t('calendar.todayInShowroom') }}</h2>
        </div>
        <span class="total">{{ total() }}</span>
      </header>

      @if (groupsResource.isLoading()) {
        <div class="widget-loading" aria-live="polite"><span></span><span></span><span></span></div>
      } @else if (error()) {
        <div class="widget-state" role="alert">
          <span>{{ i18n.t('calendar.dashboardLoadFailed') }}</span>
          <button type="button" (click)="groupsResource.reload()">
            {{ i18n.t('calendar.retry') }}
          </button>
        </div>
      } @else if (!total()) {
        <div class="widget-state widget-state--empty">
          <app-ui-icon name="calendar_month" [size]="24" />
          <span>{{ i18n.t('calendar.todayEmpty') }}</span>
        </div>
      } @else {
        <div class="office-groups">
          @for (group of groups(); track group.office.id) {
            <section>
              @if (groups().length > 1) {
                <h3>
                  {{ officeLabel(group.office) }} <span>{{ group.items.length }}</span>
                </h3>
              }
              <ol>
                @for (appointment of group.items.slice(0, 5); track appointment.id) {
                  <li>
                    <button
                      type="button"
                      class="appointment-row"
                      [class.is-visited]="appointment.status === 'visited'"
                      [class.is-no-show]="appointment.status === 'no_show'"
                      [class.is-canceled]="appointment.status === 'canceled'"
                      (click)="openAppointment(group, appointment)"
                    >
                      <time>{{ localTime(appointment) }}</time>
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
                      <span class="trailing">
                        @if (appointment.warnings.length) {
                          <app-ui-icon
                            class="warning"
                            name="warning"
                            [size]="17"
                            [attr.aria-label]="i18n.t('calendar.hasWarning')"
                          />
                        }
                        <app-ui-icon name="chevron_right" [size]="17" />
                      </span>
                    </button>
                  </li>
                }
              </ol>
            </section>
          }
        </div>
      }

      @if (openError()) {
        <p class="open-error" role="alert">{{ openError() }}</p>
      }

      <footer>
        @if (warningCount()) {
          <span class="warning-summary">
            <app-ui-icon name="warning" [size]="16" />
            {{ i18n.t('calendar.warningsCount', { count: warningCount() }) }}
          </span>
        } @else {
          <span></span>
        }
        <app-ui-button routerLink="/crm/calendar" variant="secondary" size="small">
          {{ i18n.t('calendar.openSchedule') }}
          <app-ui-icon name="chevron_right" [size]="16" />
        </app-ui-button>
      </footer>
    </section>
  `,
  styles: `
    .today-widget {
      overflow: hidden;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background:
        radial-gradient(
          circle at 92% 0,
          color-mix(in srgb, var(--ui-coral) 11%, transparent),
          transparent 32%
        ),
        var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
    }

    header,
    footer {
      padding: var(--ui-space-4) var(--ui-space-5);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
    }

    header {
      border-bottom: 1px solid var(--ui-border);
    }

    header p {
      margin: 0 0 0.2rem;
      color: var(--ui-text-subtle);
      font-size: 0.7rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      font: 700 1.15rem/1.2 var(--ui-font-display);
    }

    .total {
      min-width: 2.5rem;
      height: 2.5rem;
      padding-inline: var(--ui-space-2);
      border-radius: var(--ui-radius-pill);
      background: var(--ui-action);
      color: white;
      display: grid;
      place-items: center;
      font-weight: 750;
    }

    .office-groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    }

    .office-groups > section {
      padding: var(--ui-space-3) var(--ui-space-5);
    }

    .office-groups > section + section {
      border-left: 1px solid var(--ui-border);
    }

    h3 {
      margin: 0 0 var(--ui-space-2);
      color: var(--ui-text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    h3 span {
      margin-left: var(--ui-space-1);
      color: var(--ui-action);
    }

    ol {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      border-bottom: 1px solid var(--ui-border);
    }

    .appointment-row {
      width: 100%;
      min-height: 3.35rem;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      display: grid;
      grid-template-columns: 3.6rem minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--ui-space-3);
      text-align: left;
    }

    .appointment-row:hover {
      background: color-mix(in srgb, var(--ui-action) 5%, transparent);
    }

    .appointment-row:focus-visible {
      outline: 2px solid var(--ui-focus);
      outline-offset: -2px;
    }

    li:last-child {
      border-bottom: 0;
    }

    time {
      color: var(--ui-action);
      font-size: 0.8rem;
      font-weight: 750;
    }

    .appointment-row > span {
      min-width: 0;
      display: grid;
    }

    li strong,
    li small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    li strong {
      font-size: 0.82rem;
    }

    li small {
      color: var(--ui-text-muted);
      font-size: 0.72rem;
    }

    .appointment-comment {
      color: var(--ui-text-subtle);
      font-style: italic;
    }

    .warning,
    .warning-summary {
      color: var(--ui-warning);
    }

    .trailing {
      display: flex;
      align-items: center;
      gap: var(--ui-space-1);
      color: var(--ui-text-subtle);
    }

    .appointment-status {
      color: var(--ui-success);
      font-weight: 700;
    }

    .appointment-status.is-no-show {
      color: var(--ui-warning);
    }

    .appointment-status.is-canceled {
      color: var(--ui-danger);
    }

    .appointment-row.is-visited {
      background: color-mix(in srgb, var(--ui-success-soft) 68%, transparent);
    }

    .appointment-row.is-no-show {
      background: color-mix(in srgb, var(--ui-warning-soft) 68%, transparent);
    }

    .appointment-row.is-canceled {
      background: color-mix(in srgb, var(--ui-danger-soft) 62%, transparent);
    }

    .appointment-row.is-visited time {
      color: var(--ui-success);
    }

    .appointment-row.is-no-show time {
      color: var(--ui-warning);
    }

    .appointment-row.is-canceled time {
      color: var(--ui-danger);
    }

    .open-error {
      margin: 0;
      padding: var(--ui-space-2) var(--ui-space-5);
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
      font-size: 0.75rem;
    }

    footer {
      min-height: 4rem;
      border-top: 1px solid var(--ui-border);
      background: color-mix(in srgb, var(--ui-surface-muted) 42%, transparent);
    }

    .warning-summary {
      display: flex;
      align-items: center;
      gap: var(--ui-space-1);
      font-size: 0.75rem;
      font-weight: 650;
    }

    .widget-state,
    .widget-loading {
      min-height: 8rem;
      padding: var(--ui-space-5);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--ui-space-2);
      color: var(--ui-text-muted);
    }

    .widget-state button {
      border: 0;
      background: transparent;
      color: var(--ui-action);
      cursor: pointer;
      font-weight: 650;
    }

    .widget-loading span {
      width: 30%;
      height: 3rem;
      border-radius: var(--ui-radius-sm);
      background: var(--ui-surface-muted);
    }

    @media (max-width: 720px) {
      .office-groups {
        grid-template-columns: 1fr;
      }

      .office-groups > section + section {
        border-top: 1px solid var(--ui-border);
        border-left: 0;
      }
    }
  `,
})
export class TodayAppointmentsWidget {
  protected readonly i18n = inject(I18nService);
  private readonly session = inject(SessionService);
  private readonly appointments = inject(AppointmentsService);
  private readonly users = inject(UsersService);
  private readonly dialogs = inject(UiDialogService);
  private managersPromise: Promise<readonly CrmEmployee[]> | null = null;

  protected readonly openError = signal('');
  protected readonly groupsResource = resource({
    params: () => ({
      selectedOfficeId: this.session.selectedOfficeId(),
      offices: this.offices()
        .map((office) => `${office.id}:${office.timezone_name ?? 'UTC'}`)
        .join(','),
    }),
    loader: async ({ params }) => {
      const offices = this.offices().filter(
        (office) => !params.selectedOfficeId || office.id === params.selectedOfficeId,
      );
      return Promise.all(
        offices.map(async (office): Promise<OfficeAppointmentGroup> => {
          const from = officeDateKey(new Date(), office.timezone_name ?? 'UTC');
          const response = await this.appointments.list({
            officeId: office.id,
            from,
            to: addCalendarDays(from, 1),
          });
          return {
            office,
            items: response.items.filter((appointment) => appointment.status !== 'rescheduled'),
          };
        }),
      );
    },
  });
  protected readonly groups = computed(() => this.groupsResource.value() ?? []);
  protected readonly total = computed(() =>
    this.groups().reduce((total, group) => total + group.items.length, 0),
  );
  protected readonly warningCount = computed(() =>
    this.groups().reduce(
      (total, group) => total + group.items.filter((item) => item.warnings.length).length,
      0,
    ),
  );
  protected readonly error = computed(() => {
    const error = this.groupsResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected localTime(appointment: Appointment): string {
    return officeDateTimeParts(appointment.startsAt, appointment.office.timezoneName).time;
  }

  protected officeLabel(office: Office): string {
    return this.i18n.locale() === 'pl' ? office.name_pl : office.name_uk;
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

  protected async openAppointment(
    group: OfficeAppointmentGroup,
    appointment: Appointment,
  ): Promise<void> {
    this.openError.set('');
    try {
      const managers = await this.loadManagers();
      const ref = openAppointmentDrawer(this.dialogs, {
        office: group.office,
        managers,
        appointment,
        appointments: group.items,
      });
      ref.afterClosed().subscribe((result) => {
        if (result?.kind === 'saved' || result?.kind === 'stale') {
          this.groupsResource.reload();
        }
      });
    } catch {
      this.openError.set(this.i18n.t('calendar.drawerLoadFailed'));
    }
  }

  private offices(): readonly Office[] {
    return this.session.officeContext()?.filterOffices ?? [];
  }

  private loadManagers(): Promise<readonly CrmEmployee[]> {
    this.managersPromise ??= this.users.listManagers().catch((error: unknown) => {
      this.managersPromise = null;
      throw error;
    });
    return this.managersPromise;
  }
}
