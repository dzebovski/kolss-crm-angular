import { Component, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { LeadReportResponse } from './reports.types';

@Component({
  selector: 'app-report-summary',
  host: { class: 'report-summary-host' },
  template: `
    <section class="summary-strip" aria-labelledby="report-summary-title">
      <header class="summary-strip__identity">
        <p>KOLSS · SALES REVIEW</p>
        <h2 id="report-summary-title">{{ i18n.t('reports.summaryTitle') }}</h2>
      </header>

      <div class="summary-strip__scroll">
        <dl class="summary-ledger" [attr.aria-label]="i18n.t('reports.metrics')">
          <div class="is-meta">
            <dt>{{ i18n.t('reports.period') }}</dt>
            <dd>{{ periodLabel() }}</dd>
          </div>
          <div class="is-meta">
            <dt>{{ i18n.t('reports.generatedAt') }}</dt>
            <dd>{{ i18n.formatDateTime(report().generatedAt) }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('reports.metric.total') }}</dt>
            <dd>{{ report().totals.total }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('reports.metric.active') }}</dt>
            <dd>{{ report().totals.active }}</dd>
          </div>
          <div class="is-success is-sold">
            <dt>{{ i18n.t('reports.metric.sold') }}</dt>
            <dd class="sold-metric">
              <strong>{{ report().totals.contractSigned }}</strong>
              <span class="sold-amounts">
                @for (total of report().totals.contractTotals; track total.currency) {
                  <span>{{ i18n.formatMoney(total.total, total.currency) }}</span>
                } @empty {
                  <span>—</span>
                }
              </span>
            </dd>
          </div>
          <div class="is-danger">
            <dt>{{ i18n.t('reports.metric.lost') }}</dt>
            <dd>{{ report().totals.closedLost }}</dd>
          </div>
          <div [class.is-danger]="report().totals.inactive7d > 0">
            <dt>{{ i18n.t('reports.metric.inactive') }}</dt>
            <dd>{{ report().totals.inactive7d }}</dd>
          </div>
        </dl>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .summary-strip {
      min-width: 0;
      border: 1px solid var(--ui-border-strong);
      border-top: 0.25rem solid var(--ui-text);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .summary-strip__identity {
      padding: 0.7rem 0.9rem 0.6rem;
      border-bottom: 1px solid var(--ui-border);
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ui-space-4);
    }

    .summary-strip__identity p {
      margin: 0;
      color: var(--ui-action);
      font-size: 0.62rem;
      font-weight: 850;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    h2 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
      font-size: clamp(1rem, 2vw, 1.35rem);
      line-height: 1;
      text-align: right;
    }

    .summary-strip__scroll {
      min-width: 0;
      overflow-x: auto;
    }

    .summary-ledger {
      min-width: 58rem;
      margin: 0;
      display: grid;
      grid-template-columns:
        minmax(10rem, 1.4fr) minmax(11rem, 1.45fr) repeat(2, minmax(5.4rem, 0.65fr))
        minmax(8.5rem, 0.9fr) repeat(2, minmax(5.4rem, 0.65fr));
    }

    .summary-ledger > div {
      min-width: 0;
      padding: 0.55rem 0.75rem;
      border-left: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
    }

    .summary-ledger > div:first-child {
      border-left: 0;
    }

    .summary-ledger dt {
      color: var(--ui-text-subtle);
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 0.055em;
      line-height: 1.15;
      text-transform: uppercase;
    }

    .summary-ledger dd {
      margin: 0.14rem 0 0;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.05rem;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .summary-ledger .is-meta dd {
      font-family: inherit;
      font-size: 0.74rem;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
    }

    .summary-ledger .is-success dd {
      color: var(--ui-success);
    }

    .summary-ledger .sold-metric {
      display: flex;
      align-items: baseline;
      gap: 0.45rem;
    }

    .sold-metric > strong {
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.05rem;
      line-height: 1;
    }

    .sold-amounts {
      display: grid;
      gap: 0.08rem;
      color: var(--ui-text-muted);
      font-family: inherit;
      font-size: 0.58rem;
      font-weight: 750;
      line-height: 1.15;
      white-space: nowrap;
    }

    .summary-ledger .is-danger dd {
      color: var(--ui-danger);
    }

    @media (max-width: 42rem) {
      .summary-strip__identity {
        align-items: start;
        flex-direction: column;
        gap: 0.25rem;
      }

      h2 {
        text-align: left;
      }
    }

    @media print {
      .summary-strip {
        border-color: #555;
        border-top-color: #111;
        border-radius: 0;
        box-shadow: none;
      }

      .summary-strip__identity {
        padding: 2mm 2.5mm;
        border-color: #aaa;
      }

      .summary-strip__scroll {
        overflow: visible;
      }

      .summary-ledger {
        min-width: 0;
        grid-template-columns:
          minmax(30mm, 1.4fr) minmax(35mm, 1.45fr) repeat(2, minmax(17mm, 0.65fr))
          minmax(26mm, 0.9fr) repeat(2, minmax(17mm, 0.65fr));
      }

      .summary-ledger > div {
        padding: 1.5mm 2mm;
        border-color: #bbb;
        background: #f4f4f4;
      }

      .summary-ledger dd,
      .summary-ledger .is-success dd,
      .summary-ledger .is-danger dd {
        color: #111;
      }

      .sold-amounts {
        color: #111;
      }
    }
  `,
})
export class ReportSummary {
  protected readonly i18n = inject(I18nService);
  readonly report = input.required<LeadReportResponse>();
  readonly periodLabel = input.required<string>();
}
