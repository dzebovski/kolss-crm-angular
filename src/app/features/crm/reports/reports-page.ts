import { Component, computed, inject, resource, signal } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { MessageKey } from '../../../core/i18n/messages';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SessionService } from '../../../core/session/session.service';
import { KolssApiClient } from '../../../core/api/generated/kolss-api.client';
import { officeName } from '../../../services/crm-mock.helpers';
import type { FunnelStage, ManagerOfficeReport } from '../../../services/crm-mock.types';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import { UiUser } from '../../../ui/user/ui-user';

@Component({
  selector: 'app-reports-page',
  imports: [UiAlert, UiBadge, UiUser, TranslatePipe],
  template: `
    <section class="reports-page" aria-labelledby="reports-title">
      <header class="page-header">
        <div>
          <p class="page-kicker">Cohort analytics</p>
          <h1 id="reports-title">{{ 'reports.title' | translate }}</h1>
          <p>{{ 'reports.subtitle' | translate }}</p>
        </div>

        <div class="period-switcher" [attr.aria-label]="'reports.period' | translate">
          @for (period of periods(); track period.days) {
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
        <app-ui-alert tone="danger" [title]="'reports.loadError' | translate">
          {{ loadError() }}
        </app-ui-alert>
      }

      <div class="metrics-grid" [attr.aria-label]="'reports.metrics' | translate">
        @for (stage of funnel(); track stage.key) {
          <article class="metric-card">
            <span>{{ funnelLabel(stage.label) }}</span>
            <strong>{{ stage.count }}</strong>
            <app-ui-badge [tone]="stage.tone">{{
              'reports.percentOfAll' | translate: { percent: stage.percentOfTotal }
            }}</app-ui-badge>
          </article>
        }
      </div>

      <section class="funnel-panel" aria-labelledby="funnel-title">
        <header>
          <div>
            <h2 id="funnel-title">{{ 'reports.funnel' | translate }}</h2>
            <p>{{ 'reports.cohort' | translate: { count: totalLeads() } }}</p>
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
                    <small>{{
                      'reports.conversionFrom'
                        | translate
                          : {
                              percent: stage.conversionFromPrevious,
                              base: funnelLabel(stage.conversionBaseLabel),
                            }
                    }}</small>
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
            <h2 id="manager-reports-title">{{ 'reports.managerReports' | translate }}</h2>
            <p>{{ 'reports.managerReportsDesc' | translate }}</p>
          </div>
          <app-ui-badge tone="info">{{ 'reports.kyivAndWarsaw' | translate }}</app-ui-badge>
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
                    <th scope="col">{{ 'reports.manager' | translate }}</th>
                    <th scope="col">{{ 'reports.takenCount' | translate }}</th>
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
                      <td>{{ 'common.noManager' | translate }}</td>
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
  private readonly api = inject(KolssApiClient);
  protected readonly i18n = inject(I18nService);

  protected readonly periods = computed(() => [
    { label: this.i18n.t('reports.period.40days'), days: 40 },
    { label: this.i18n.t('reports.period.week'), days: 7 },
    { label: this.i18n.t('reports.period.month'), days: 30 },
    { label: this.i18n.t('reports.period.6months'), days: 180 },
  ]);
  protected readonly periodDays = signal(40);

  protected readonly reportResource = resource({
    params: () => ({ officeId: this.session.selectedOfficeId(), days: this.periodDays() }),
    loader: ({ params }) => this.api.report(params) as Promise<LeadReportResponse>,
  });

  protected readonly loadError = computed(() => {
    const error = this.reportResource.error();
    return error instanceof Error ? error.message : error ? String(error) : '';
  });

  protected readonly funnel = computed(() => this.buildFunnel(this.reportResource.value()?.funnel ?? {}));
  protected readonly totalLeads = computed(() => this.funnel()[0]?.count ?? 0);
  protected readonly periodLabel = computed(
    () => this.periods().find((period) => period.days === this.periodDays())?.label ?? this.i18n.t('reports.period'),
  );

  protected readonly managerReports = computed((): readonly ManagerOfficeReport[] => {
    const rows = this.reportResource.value()?.managers ?? [];
    return (['kyiv', 'warsaw'] as const).map((officeCode) => ({
      officeCode,
      officeLabel: officeName(officeCode),
      managers: rows
        .filter((row) => row.officeCode === officeCode && row.managerId)
        .map((row) => ({
          managerId: row.managerId ?? '',
          managerName: row.managerName || this.i18n.t('common.unknown'),
          takenCount: row.takenCount,
        })),
      unassignedCount: rows
        .filter((row) => row.officeCode === officeCode && !row.managerId)
        .reduce((sum, row) => sum + row.takenCount, 0),
    }));
  });

  private buildFunnel(counts: Readonly<Record<string, number>>): readonly FunnelStage[] {
    const stages = [
      ['created', 'funnel.created', 'brand'],
      ['taken', 'funnel.taken', 'info'],
      ['scheduled', 'funnel.scheduled', 'warning'],
      ['visited', 'funnel.visited', 'success'],
      ['successful', 'funnel.successful', 'success'],
      ['closed', 'funnel.closed', 'danger'],
    ] as const;
    const total = counts['created'] ?? 0;
    const base: Readonly<Record<string, string>> = {
      taken: 'created',
      scheduled: 'taken',
      visited: 'scheduled',
      successful: 'taken',
      closed: 'taken',
    };
    return stages.map(([key, label, tone]) => {
      const count = counts[key] ?? 0;
      const baseKey = base[key];
      const baseCount = baseKey ? (counts[baseKey] ?? 0) : 0;
      return {
        key,
        label,
        tone,
        count,
        percentOfTotal: total ? Math.round((count / total) * 100) : 0,
        conversionFromPrevious: baseCount ? Math.round((count / baseCount) * 100) : 0,
        conversionBaseLabel: baseKey ? `funnel.${baseKey}` : null,
      };
    });
  }

  protected funnelLabel(key: string | null): string {
    if (!key) return '';
    return this.i18n.t(key as MessageKey);
  }

  protected barWidth(stage: FunnelStage): number {
    return Math.max(stage.percentOfTotal, stage.count > 0 ? 6 : 0);
  }
}

interface LeadReportResponse {
  readonly days: number;
  readonly funnel: Readonly<Record<string, number>>;
  readonly managers: readonly {
    readonly officeCode: string;
    readonly managerId: string | null;
    readonly managerName: string;
    readonly takenCount: number;
  }[];
}
