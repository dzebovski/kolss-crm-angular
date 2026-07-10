import { Component, computed, inject, resource, signal } from '@angular/core';

import { SessionService } from '../../../core/session/session.service';
import { calculateFunnel, calculateManagerTakenReport } from '../../../services/crm-mock.helpers';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import type { FunnelStage, ManagerOfficeReport } from '../../../services/crm-mock.types';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiUser } from '../../../ui/user/ui-user';

@Component({
  selector: 'app-reports-page',
  imports: [UiAlert, UiBadge, UiUser],
  template: `
    <section class="reports-page" aria-labelledby="reports-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">Cohort analytics</p>
          <h1 id="reports-title">Звітність</h1>
          <p>Метрики рахуються по лідах, створених у вибраному періоді.</p>
        </div>

        <div class="period-switcher" aria-label="Період звітності">
          @for (period of periods; track period.days) {
            <button
              type="button"
              [class.is-active]="periodDays() === period.days"
              (click)="periodDays.set(period.days)"
            >
              {{ period.label }}
            </button>
          }
        </div>
      </header>

      @if (loadError()) {
        <app-ui-alert tone="danger" title="Не вдалося завантажити звітність">
          {{ loadError() }}
        </app-ui-alert>
      }

      <div class="metrics-grid" aria-label="Основні метрики">
        @for (stage of funnel(); track stage.key) {
          <article class="metric-card">
            <span>{{ stage.label }}</span>
            <strong>{{ stage.count }}</strong>
            <app-ui-badge [tone]="stage.tone">{{ stage.percentOfTotal }}% від усіх</app-ui-badge>
          </article>
        }
      </div>

      <section class="funnel-panel" aria-labelledby="funnel-title">
        <header>
          <div>
            <h2 id="funnel-title">Воронка за період</h2>
            <p>{{ totalLeads() }} лідів у когорті, офісний фільтр береться з CRM shell.</p>
          </div>
          <app-ui-badge tone="brand">{{ periodLabel() }}</app-ui-badge>
        </header>

        <ol class="funnel-list">
          @for (stage of funnel(); track stage.key; let index = $index) {
            <li>
              <div class="funnel-row">
                <span class="funnel-index">{{ index + 1 }}</span>
                <div>
                  <strong>{{ stage.label }}</strong>
                  @if (stage.conversionBaseLabel) {
                    <small>{{ stage.conversionFromPrevious }}% від {{ stage.conversionBaseLabel }}</small>
                  }
                </div>
                <b>{{ stage.count }}</b>
              </div>
              <div
                class="funnel-track"
                [attr.aria-label]="stage.label + ': ' + stage.percentOfTotal + '%'"
              >
                <span [style.width.%]="barWidth(stage)"></span>
              </div>
            </li>
          }
        </ol>
      </section>

      <section class="manager-reports" aria-labelledby="manager-reports-title">
        <header class="manager-reports__header">
          <div>
            <h2 id="manager-reports-title">Звіт по менеджерам</h2>
            <p>Кількість лідів, взятих у роботу за обраний період.</p>
          </div>
          <app-ui-badge tone="info">Київ і Варшава</app-ui-badge>
        </header>

        <div class="manager-reports__grid">
          @for (report of managerReports(); track report.officeCode) {
            <section
              class="manager-office-panel"
              [attr.aria-labelledby]="'manager-office-' + report.officeCode"
            >
              <h3 [id]="'manager-office-' + report.officeCode">{{ report.officeLabel }}</h3>

              <table class="manager-table">
                <thead>
                  <tr>
                    <th scope="col">Менеджер</th>
                    <th scope="col">Взято в роботу</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of report.managers; track row.managerId) {
                    <tr>
                      <td>
                        <app-ui-user
                          [userId]="row.managerId"
                          [name]="row.managerName"
                          size="sm"
                          [showName]="true"
                        />
                      </td>
                      <td class="manager-table__count">{{ row.takenCount }}</td>
                    </tr>
                  }
                  @if (report.unassignedCount > 0) {
                    <tr>
                      <td>Без менеджера</td>
                      <td class="manager-table__count">{{ report.unassignedCount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>
          }
        </div>
      </section>
    </section>
  `,
  styles: `
    .reports-page {
      display: grid;
      gap: var(--ui-space-5);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: var(--ui-space-6);
    }

    .page-kicker {
      margin: 0 0 var(--ui-space-2);
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1,
    h2 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
      letter-spacing: 0;
    }

    h1 {
      font-size: 2rem;
    }

    h2 {
      font-size: 1.25rem;
    }

    .page-header p,
    .funnel-panel p,
    .manager-reports__header p {
      margin: var(--ui-space-2) 0 0;
      color: var(--ui-text-muted);
    }

    .period-switcher {
      padding: 0.1875rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-subtle);
      display: flex;
      gap: 0.125rem;
    }

    .period-switcher button {
      min-height: 2rem;
      min-width: 5rem;
      padding: 0 var(--ui-space-3);
      border: 0;
      border-radius: calc(var(--ui-radius-md) - 0.1875rem);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .period-switcher button.is-active {
      background: var(--ui-surface-raised);
      color: var(--ui-action);
      box-shadow: var(--ui-shadow-1);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: var(--ui-space-3);
    }

    .metric-card {
      min-height: 8rem;
      padding: var(--ui-space-4);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      display: grid;
      align-content: space-between;
      gap: var(--ui-space-3);
      box-shadow: var(--ui-shadow-1);
    }

    .metric-card span {
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    .metric-card strong {
      font-family: var(--ui-font-display), sans-serif;
      font-size: 2rem;
      line-height: 1;
    }

    .funnel-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .funnel-panel > header {
      min-height: 5rem;
      padding: var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-space-4);
    }

    .funnel-list {
      margin: 0;
      padding: var(--ui-space-5);
      display: grid;
      gap: var(--ui-space-4);
      list-style: none;
    }

    .funnel-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--ui-space-3);
      align-items: center;
    }

    .funnel-index {
      width: 2rem;
      height: 2rem;
      border-radius: var(--ui-radius-md);
      background: color-mix(in srgb, var(--ui-action) 10%, white);
      color: var(--ui-action);
      display: grid;
      place-items: center;
      font-size: 0.75rem;
      font-weight: 800;
    }

    .funnel-row strong,
    .funnel-row small {
      display: block;
    }

    .funnel-row small {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
    }

    .funnel-row b {
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.35rem;
    }

    .funnel-track {
      height: 0.75rem;
      margin-top: var(--ui-space-2);
      border-radius: var(--ui-radius-pill);
      background: var(--ui-surface-muted);
      overflow: hidden;
    }

    .funnel-track span {
      height: 100%;
      min-width: 0.25rem;
      border-radius: inherit;
      background: var(--ui-brand-gradient);
      display: block;
      transition: width var(--ui-duration) var(--ui-ease);
    }

    .manager-reports {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .manager-reports__header {
      min-height: 5rem;
      padding: var(--ui-space-5);
      border-bottom: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ui-space-4);
    }

    .manager-reports__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
      padding: var(--ui-space-5);
    }

    .manager-office-panel {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-subtle);
      overflow: hidden;
    }

    .manager-office-panel h3 {
      margin: 0;
      padding: var(--ui-space-4) var(--ui-space-4) var(--ui-space-3);
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.05rem;
    }

    .manager-table {
      width: 100%;
      border-collapse: collapse;
    }

    .manager-table th,
    .manager-table td {
      padding: var(--ui-space-3) var(--ui-space-4);
      border-top: 1px solid var(--ui-border);
      text-align: left;
      vertical-align: middle;
    }

    .manager-table th {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .manager-table__count {
      width: 6rem;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      text-align: right;
    }
  `,
})
export class ReportsPage {
  private readonly session = inject(SessionService);
  private readonly leadsService = inject(LeadsService);
  private readonly usersService = inject(UsersService);

  protected readonly periods = [
    { label: '40 днів', days: 40 },
    { label: 'Тиждень', days: 7 },
    { label: 'Місяць', days: 30 },
    { label: '6 місяців', days: 180 },
  ] as const;
  protected readonly periodDays = signal(40);

  protected readonly leadsResource = resource({
    params: () => ({ officeId: this.session.selectedOfficeId() }),
    loader: ({ params }) => this.leadsService.list({ officeId: params.officeId }),
  });

  protected readonly allLeadsResource = resource({
    loader: () => this.leadsService.list(),
  });

  protected readonly employeesResource = resource({
    loader: () => this.usersService.listEmployees(),
  });

  protected readonly loadError = computed(() => {
    const error =
      this.leadsResource.error() ?? this.allLeadsResource.error() ?? this.employeesResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected readonly funnel = computed(() =>
    calculateFunnel(this.leadsResource.value() ?? [], this.periodDays()),
  );
  protected readonly totalLeads = computed(() => this.funnel()[0]?.count ?? 0);
  protected readonly periodLabel = computed(
    () => this.periods.find((period) => period.days === this.periodDays())?.label ?? 'Період',
  );

  protected readonly managerReports = computed((): readonly ManagerOfficeReport[] => {
    const leads = this.allLeadsResource.value() ?? [];
    const employees = this.employeesResource.value() ?? [];
    const periodDays = this.periodDays();

    return [
      calculateManagerTakenReport(leads, employees, 'kyiv', periodDays),
      calculateManagerTakenReport(leads, employees, 'warsaw', periodDays),
    ];
  });

  protected barWidth(stage: FunnelStage): number {
    return Math.max(stage.percentOfTotal, stage.count > 0 ? 6 : 0);
  }
}
