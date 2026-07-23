import { Component, computed, inject, resource } from '@angular/core';
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
import { UiButton } from '../../../ui/button/ui-button';
import { UiIcon } from '../../../ui/icon/ui-icon';

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
                    <time>{{ localTime(appointment) }}</time>
                    <span>
                      <strong>{{ appointment.lead.name || appointment.lead.phone }}</strong>
                      <small>{{
                        appointment.responsibleManager?.displayName ?? i18n.t('common.noManager')
                      }}</small>
                    </span>
                    @if (appointment.warnings.length) {
                      <app-ui-icon
                        class="warning"
                        name="warning"
                        [size]="17"
                        [attr.aria-label]="i18n.t('calendar.hasWarning')"
                      />
                    }
                  </li>
                }
              </ol>
            </section>
          }
        </div>
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
      min-height: 3.35rem;
      display: grid;
      grid-template-columns: 3.6rem minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--ui-space-3);
      border-bottom: 1px solid var(--ui-border);
    }

    li:last-child {
      border-bottom: 0;
    }

    time {
      color: var(--ui-action);
      font-size: 0.8rem;
      font-weight: 750;
    }

    li > span {
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

    .warning,
    .warning-summary {
      color: var(--ui-warning);
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
            status: 'scheduled',
          });
          return { office, items: response.items };
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

  private offices(): readonly Office[] {
    return this.session.officeContext()?.filterOffices ?? [];
  }
}
