import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { ClientStatus } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import type { LeadReportResponse, LossReasonReport } from './reports.types';

const FUNNEL_STATUSES: readonly ClientStatus[] = [
  'new_lead',
  'calculation_in_progress',
  'showroom_invited',
  'thinking',
  'contract_signed',
  'closed_lost',
];

@Component({
  selector: 'app-report-summary',
  imports: [UiBadge],
  host: { class: 'report-summary-host' },
  template: `
    <section class="summary-sheet" aria-labelledby="report-summary-title">
      <header class="summary-masthead">
        <div>
          <p class="summary-masthead__kicker">KOLSS · SALES REVIEW</p>
          <h2 id="report-summary-title">{{ i18n.t('reports.summaryTitle') }}</h2>
        </div>
        <dl class="summary-masthead__meta">
          <div>
            <dt>{{ i18n.t('reports.period') }}</dt>
            <dd>{{ periodLabel() }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('reports.generatedAt') }}</dt>
            <dd>{{ i18n.formatDateTime(report().generatedAt) }}</dd>
          </div>
        </dl>
      </header>

      <div class="metric-ledger" [attr.aria-label]="i18n.t('reports.metrics')">
        <article>
          <span>{{ i18n.t('reports.metric.total') }}</span>
          <strong>{{ report().totals.total }}</strong>
          <small>{{ i18n.t('reports.metric.totalHint') }}</small>
        </article>
        <article>
          <span>{{ i18n.t('reports.metric.active') }}</span>
          <strong>{{ report().totals.active }}</strong>
          <small>{{ i18n.t('reports.metric.activeHint') }}</small>
        </article>
        <article class="is-success">
          <span>{{ i18n.t('reports.metric.sold') }}</span>
          <strong>{{ report().totals.contractSigned }}</strong>
          <small>{{
            i18n.t('reports.metric.conversion', { percent: report().totals.conversionPercent })
          }}</small>
        </article>
        <article class="is-danger">
          <span>{{ i18n.t('reports.metric.lost') }}</span>
          <strong>{{ report().totals.closedLost }}</strong>
          <small>{{ i18n.t('reports.metric.lostHint') }}</small>
        </article>
        <article>
          <span>{{ i18n.t('reports.metric.callback') }}</span>
          <strong>{{ report().totals.callback }}</strong>
          <small>{{ i18n.t('reports.metric.callbackHint') }}</small>
        </article>
        <article class="is-danger">
          <span>{{ i18n.t('reports.metric.inactive') }}</span>
          <strong>{{ report().totals.inactive7d }}</strong>
          <small>{{ i18n.t('reports.metric.inactiveHint') }}</small>
        </article>
      </div>

      <div class="summary-body">
        <section class="pipeline-panel" aria-labelledby="current-funnel-title">
          <header>
            <div>
              <p>{{ i18n.t('reports.currentSnapshot') }}</p>
              <h3 id="current-funnel-title">{{ i18n.t('reports.funnel') }}</h3>
            </div>
            <app-ui-badge tone="brand">{{ report().totals.total }}</app-ui-badge>
          </header>
          <ol>
            @for (status of funnelStatuses; track status; let index = $index) {
              <li>
                <span class="pipeline-index">{{ index + 1 }}</span>
                <div class="pipeline-copy">
                  <strong>{{ statusLabel(status) }}</strong>
                  <div class="pipeline-track" aria-hidden="true">
                    <span [style.width.%]="barWidth(status)"></span>
                  </div>
                </div>
                <b>{{ statusCount(status) }}</b>
                <small>{{ statusPercent(status) }}%</small>
              </li>
            }
          </ol>
        </section>

        <section class="loss-panel" aria-labelledby="loss-reasons-title">
          <header>
            <p>{{ i18n.t('reports.lossAnalysis') }}</p>
            <h3 id="loss-reasons-title">{{ i18n.t('reports.lossReasons') }}</h3>
          </header>
          @if (report().lossReasons.length > 0) {
            <table>
              <thead>
                <tr>
                  <th scope="col">{{ i18n.t('reports.reason') }}</th>
                  <th scope="col">{{ i18n.t('reports.count') }}</th>
                  <th scope="col">%</th>
                </tr>
              </thead>
              <tbody>
                @for (reason of report().lossReasons; track reason.code) {
                  <tr>
                    <td>{{ lossReasonLabel(reason) }}</td>
                    <td>{{ reason.count }}</td>
                    <td>{{ reason.percent }}%</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="loss-panel__empty">{{ i18n.t('reports.noLosses') }}</p>
          }
        </section>
      </div>

      <section class="manager-comparison" aria-labelledby="manager-comparison-title">
        <header>
          <div>
            <p>{{ i18n.t('reports.teamSnapshot') }}</p>
            <h3 id="manager-comparison-title">{{ i18n.t('reports.managerComparison') }}</h3>
          </div>
        </header>
        <div class="manager-comparison__table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{{ i18n.t('reports.manager') }}</th>
                <th scope="col">{{ i18n.t('reports.office') }}</th>
                <th scope="col">{{ i18n.t('reports.metric.total') }}</th>
                <th scope="col">{{ i18n.t('reports.metric.active') }}</th>
                <th scope="col">{{ i18n.t('reports.metric.sold') }}</th>
                <th scope="col">{{ i18n.t('reports.metric.lost') }}</th>
                <th scope="col">{{ i18n.t('reports.metric.inactive') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (
                manager of report().managers;
                track manager.officeCode + '-' + manager.managerId
              ) {
                <tr>
                  <td>
                    <strong>{{ manager.managerName || i18n.t('common.noManager') }}</strong>
                  </td>
                  <td>{{ i18n.officeFilterLabel(manager.officeCode) }}</td>
                  <td>{{ manager.totals.total }}</td>
                  <td>{{ manager.totals.active }}</td>
                  <td>{{ manager.totals.contractSigned }}</td>
                  <td>{{ manager.totals.closedLost }}</td>
                  <td [class.has-alert]="manager.totals.inactive7d > 0">
                    {{ manager.totals.inactive7d }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .summary-sheet {
      min-width: 0;
      padding: clamp(1.25rem, 3vw, 2.25rem);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background:
        linear-gradient(
            90deg,
            color-mix(in srgb, var(--ui-action) 5%, transparent) 1px,
            transparent 1px
          )
          0 0 / 3rem 3rem,
        var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-2);
    }

    .summary-masthead {
      padding-bottom: var(--ui-space-5);
      border-bottom: 0.2rem solid var(--ui-text);
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: var(--ui-space-6);
    }

    .summary-masthead__kicker,
    .pipeline-panel header p,
    .loss-panel header p,
    .manager-comparison header p {
      margin: 0 0 0.2rem;
      color: var(--ui-action);
      font-size: 0.66rem;
      font-weight: 850;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    h2,
    h3 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
    }

    h2 {
      font-size: clamp(1.65rem, 3.2vw, 2.5rem);
      line-height: 1;
    }

    h3 {
      font-size: 1.05rem;
    }

    .summary-masthead__meta {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(8rem, auto));
      gap: var(--ui-space-5);
    }

    .summary-masthead__meta dt {
      color: var(--ui-text-subtle);
      font-size: 0.62rem;
      font-weight: 750;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .summary-masthead__meta dd {
      margin: 0.12rem 0 0;
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
    }

    .metric-ledger {
      margin-top: var(--ui-space-5);
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      border: 1px solid var(--ui-border-strong);
      border-radius: var(--ui-radius-md);
      overflow: hidden;
    }

    .metric-ledger article {
      min-width: 0;
      padding: 0.85rem 1rem;
      border-left: 1px solid var(--ui-border);
      background: color-mix(in srgb, var(--ui-surface-raised) 88%, var(--ui-surface-muted));
    }

    .metric-ledger article:first-child {
      border-left: 0;
    }

    .metric-ledger span,
    .metric-ledger small {
      display: block;
    }

    .metric-ledger span {
      min-height: 2.2em;
      color: var(--ui-text-muted);
      font-size: 0.68rem;
      font-weight: 750;
      text-transform: uppercase;
    }

    .metric-ledger strong {
      display: block;
      margin-top: 0.15rem;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.8rem;
      line-height: 1;
    }

    .metric-ledger small {
      margin-top: 0.35rem;
      color: var(--ui-text-subtle);
      font-size: 0.65rem;
      line-height: 1.25;
    }

    .metric-ledger .is-success strong {
      color: var(--ui-success);
    }

    .metric-ledger .is-danger strong {
      color: var(--ui-danger);
    }

    .summary-body {
      margin-top: var(--ui-space-5);
      display: grid;
      grid-template-columns: minmax(0, 1.65fr) minmax(17rem, 0.85fr);
      gap: var(--ui-space-4);
    }

    .pipeline-panel,
    .loss-panel,
    .manager-comparison {
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: color-mix(in srgb, var(--ui-surface-raised) 94%, var(--ui-surface-muted));
      overflow: hidden;
    }

    .pipeline-panel > header,
    .loss-panel > header,
    .manager-comparison > header {
      min-height: 3.5rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--ui-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
    }

    .pipeline-panel ol {
      margin: 0;
      padding: 0.5rem 1rem 0.8rem;
      display: grid;
      gap: 0.05rem;
      list-style: none;
    }

    .pipeline-panel li {
      display: grid;
      grid-template-columns: 1.55rem minmax(0, 1fr) 2.2rem 2.5rem;
      gap: 0.65rem;
      align-items: center;
      min-height: 2.35rem;
    }

    .pipeline-index {
      width: 1.45rem;
      height: 1.45rem;
      border-radius: 50%;
      background: var(--ui-text);
      color: white;
      display: grid;
      place-items: center;
      font-size: 0.62rem;
      font-weight: 800;
    }

    .pipeline-copy strong {
      display: block;
      font-size: 0.76rem;
    }

    .pipeline-track {
      height: 0.28rem;
      margin-top: 0.25rem;
      background: var(--ui-surface-muted);
      overflow: hidden;
    }

    .pipeline-track span {
      height: 100%;
      display: block;
      background: var(--ui-brand-gradient);
    }

    .pipeline-panel li b {
      font-family: var(--ui-font-display), sans-serif;
      text-align: right;
    }

    .pipeline-panel li small {
      color: var(--ui-text-subtle);
      font-size: 0.68rem;
      text-align: right;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0.5rem 0.7rem;
      border-top: 1px solid var(--ui-border);
      font-size: 0.72rem;
      text-align: left;
    }

    thead th {
      border-top: 0;
      background: var(--ui-surface-muted);
      color: var(--ui-text-subtle);
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .loss-panel th:nth-child(n + 2),
    .loss-panel td:nth-child(n + 2),
    .manager-comparison th:nth-child(n + 3),
    .manager-comparison td:nth-child(n + 3) {
      text-align: right;
    }

    .loss-panel__empty {
      margin: 0;
      padding: 1.5rem 1rem;
      color: var(--ui-text-subtle);
      font-size: 0.8rem;
    }

    .manager-comparison {
      margin-top: var(--ui-space-4);
    }

    .manager-comparison__table-wrap {
      overflow-x: auto;
    }

    .manager-comparison table {
      min-width: 45rem;
    }

    .manager-comparison .has-alert {
      color: var(--ui-danger);
      font-weight: 800;
    }

    @media (max-width: 70rem) {
      .metric-ledger {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .metric-ledger article:nth-child(4) {
        border-left: 0;
        border-top: 1px solid var(--ui-border);
      }

      .metric-ledger article:nth-child(5),
      .metric-ledger article:nth-child(6) {
        border-top: 1px solid var(--ui-border);
      }
    }

    @media (max-width: 48rem) {
      .summary-masthead {
        align-items: start;
        flex-direction: column;
      }

      .summary-masthead__meta,
      .summary-body {
        grid-template-columns: 1fr;
      }

      .metric-ledger {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .metric-ledger article:nth-child(odd) {
        border-left: 0;
      }

      .metric-ledger article:nth-child(n + 3) {
        border-top: 1px solid var(--ui-border);
      }
    }

    @media print {
      :host {
        break-after: page;
      }

      .summary-sheet {
        padding: 0;
        border: 0;
        border-radius: 0;
        background: white;
        box-shadow: none;
      }

      .summary-masthead {
        padding-bottom: 3mm;
        border-bottom-color: #111;
      }

      .metric-ledger {
        margin-top: 4mm;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        border-color: #777;
      }

      .metric-ledger article {
        padding: 2.5mm 3mm;
        border-color: #aaa;
        background: white;
      }

      .metric-ledger strong {
        color: #111 !important;
      }

      .summary-body {
        margin-top: 4mm;
        grid-template-columns: minmax(0, 1.65fr) minmax(60mm, 0.85fr);
        gap: 4mm;
      }

      .pipeline-panel,
      .loss-panel,
      .manager-comparison {
        border-color: #999;
        background: white;
      }

      .pipeline-panel > header,
      .loss-panel > header,
      .manager-comparison > header,
      thead th {
        background: #f1f1f1;
      }

      .pipeline-index {
        background: #111;
      }

      .pipeline-track span {
        background: #333;
      }

      .manager-comparison {
        margin-top: 4mm;
      }

      .manager-comparison__table-wrap {
        overflow: visible;
      }

      .manager-comparison table {
        min-width: 0;
      }

      th,
      td {
        padding: 1.7mm 2.2mm;
        border-color: #bbb;
      }
    }
  `,
})
export class ReportSummary {
  protected readonly i18n = inject(I18nService);
  readonly report = input.required<LeadReportResponse>();
  readonly periodLabel = input.required<string>();
  protected readonly funnelStatuses = FUNNEL_STATUSES;

  protected readonly total = computed(() => this.report().totals.total);

  protected statusCount(status: ClientStatus): number {
    return this.report().totals.byClientStatus[status] ?? 0;
  }

  protected statusPercent(status: ClientStatus): number {
    return this.total() ? Math.round((this.statusCount(status) / this.total()) * 100) : 0;
  }

  protected barWidth(status: ClientStatus): number {
    const percent = this.statusPercent(status);
    return percent > 0 ? Math.max(percent, 3) : 0;
  }

  protected statusLabel(status: ClientStatus): string {
    if (status === 'new_lead') return this.i18n.t('reports.status.inWork');
    if (status === 'showroom_invited') return this.i18n.t('reports.status.awaitingShowroom');
    if (status === 'closed_lost') return this.i18n.t('reports.status.lost');
    return this.i18n.clientStatusLabel(status);
  }

  protected lossReasonLabel(reason: LossReasonReport): string {
    if (reason.code !== 'unspecified') {
      return this.i18n.closeReasonLabel(reason.code, [
        { code: reason.code, label_uk: reason.labelUk, label_pl: reason.labelPl },
      ]);
    }
    const labels: Readonly<Record<string, string>> = {
      uk: reason.labelUk,
      pl: reason.labelPl,
      en: reason.labelEn,
    };
    return labels[this.i18n.locale()] ?? reason.labelEn;
  }
}
