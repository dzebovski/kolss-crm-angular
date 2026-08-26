import { Component, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { ReportLeadBlock } from './report-lead-block';
import type { ReportLead } from './reports.types';

@Component({
  selector: 'app-lead-report-table',
  imports: [ReportLeadBlock],
  host: { class: 'lead-report-table-host' },
  template: `
    <section class="lead-report-sheet">
      <div class="lead-report-sheet__table-wrap">
        <table class="lead-report-table">
          <colgroup>
            <col class="column-date" />
            <col class="column-contact" />
            <col class="column-call" />
            <col class="column-status" />
            <col class="column-comment" />
            <col class="column-comment" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{{ i18n.t('reports.column.createdDate') }}</th>
              <th scope="col">{{ i18n.t('reports.column.contact') }}</th>
              <th scope="col">{{ i18n.t('reports.column.callResult') }}</th>
              <th scope="col">{{ i18n.t('reports.column.clientStatus') }}</th>
              <th scope="col">{{ i18n.t('reports.column.latestComment') }}</th>
              <th scope="col">{{ i18n.t('reports.column.previousComment') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (lead of leads(); track lead.id) {
              <tr appReportLeadBlock [lead]="lead"></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .lead-report-sheet {
      min-width: 0;
      border: 1px solid var(--ui-border-strong);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .lead-report-sheet__table-wrap {
      min-width: 0;
      overflow-x: auto;
    }

    .lead-report-table {
      width: 100%;
      min-width: 68rem;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .lead-report-table .column-date {
      width: 8%;
    }

    .lead-report-table .column-contact {
      width: 14%;
    }

    .lead-report-table .column-call {
      width: 12%;
    }

    .lead-report-table .column-status {
      width: 13%;
    }

    .lead-report-table .column-comment {
      width: 26.5%;
    }

    .lead-report-table thead {
      display: table-header-group;
    }

    .lead-report-table thead th {
      padding: 0.4rem 0.5rem;
      border-right: 1px solid var(--ui-border);
      background: var(--ui-surface-muted);
      color: var(--ui-text-subtle);
      font-size: 0.58rem;
      font-weight: 850;
      letter-spacing: 0.045em;
      line-height: 1.15;
      text-align: left;
      text-transform: uppercase;
      vertical-align: bottom;
    }

    .lead-report-table thead th:last-child {
      border-right: 0;
    }

    @media print {
      .lead-report-sheet {
        border-color: #666;
        border-radius: 0;
        box-shadow: none;
        overflow: visible;
      }

      .lead-report-sheet__table-wrap {
        overflow: visible;
      }

      .lead-report-table {
        min-width: 0;
      }

      .lead-report-table thead th {
        padding: 1.2mm 1.4mm;
        border-color: #aaa;
        background: #ececec;
      }
    }
  `,
})
export class LeadReportTable {
  protected readonly i18n = inject(I18nService);
  readonly leads = input.required<readonly ReportLead[]>();
}
