import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { ClientStatus } from '../../../services/crm-mock.types';
import { ReportLeadBlock } from './report-lead-block';
import type { ManagerLeadReport, ReportStatusGroup } from './reports.types';

const STATUS_ORDER: readonly ClientStatus[] = [
  'new_lead',
  'calculation_in_progress',
  'showroom_invited',
  'thinking',
  'contract_signed',
  'closed_lost',
];

@Component({
  selector: 'app-manager-report-section',
  imports: [ReportLeadBlock],
  host: { class: 'manager-report-host' },
  template: `
    <section class="manager-sheet" [attr.aria-labelledby]="managerHeadingId()">
      <header class="manager-sheet__header">
        <div class="manager-sheet__identity">
          <p>
            {{ i18n.t('reports.managerSection') }} ·
            {{ i18n.officeFilterLabel(manager().officeCode) }}
          </p>
          <h2 [id]="managerHeadingId()">{{ managerName() }}</h2>
        </div>

        <dl class="manager-sheet__totals">
          <div>
            <dt>{{ i18n.t('reports.metric.total') }}</dt>
            <dd>{{ manager().totals.total }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('reports.metric.active') }}</dt>
            <dd>{{ manager().totals.active }}</dd>
          </div>
          <div class="is-sold">
            <dt>{{ i18n.t('reports.metric.sold') }}</dt>
            <dd class="sold-metric">
              <strong>{{ manager().totals.contractSigned }}</strong>
              <span class="sold-amounts">
                @for (total of manager().totals.contractTotals; track total.currency) {
                  <span>{{ i18n.formatMoney(total.total, total.currency) }}</span>
                } @empty {
                  <span>—</span>
                }
              </span>
            </dd>
          </div>
          <div>
            <dt>{{ i18n.t('reports.metric.lost') }}</dt>
            <dd>{{ manager().totals.closedLost }}</dd>
          </div>
          <div [class.is-alert]="manager().totals.inactive7d > 0">
            <dt>{{ i18n.t('reports.metric.inactive') }}</dt>
            <dd>{{ manager().totals.inactive7d }}</dd>
          </div>
        </dl>
      </header>

      <div class="manager-sheet__table-wrap">
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

          @for (group of statusGroups(); track group.status) {
            <tbody class="status-group" [attr.aria-labelledby]="statusHeadingId(group.status)">
              <tr class="status-group__heading">
                <th colspan="6" scope="rowgroup" [id]="statusHeadingId(group.status)">
                  <span>{{ statusLabel(group.status) }}</span>
                  <small>{{ i18n.t('reports.leadCount', { count: group.leads.length }) }}</small>
                </th>
              </tr>
              @for (lead of group.leads; track lead.id) {
                <tr appReportLeadBlock [lead]="lead"></tr>
              }
            </tbody>
          }
        </table>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .manager-sheet {
      min-width: 0;
      border: 1px solid var(--ui-border-strong);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
    }

    .manager-sheet__header {
      padding: 0.65rem 0.8rem;
      border-bottom: 2px solid var(--ui-text);
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: var(--ui-space-4);
      break-after: avoid-page;
    }

    .manager-sheet__identity {
      min-width: 10rem;
    }

    .manager-sheet__identity p {
      margin: 0 0 0.15rem;
      color: var(--ui-action);
      font-size: 0.58rem;
      font-weight: 850;
      letter-spacing: 0.075em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
      font-size: clamp(1.15rem, 2.2vw, 1.55rem);
      line-height: 1;
    }

    .manager-sheet__totals {
      margin: 0;
      border: 1px solid var(--ui-border);
      display: flex;
      flex: 0 0 auto;
    }

    .manager-sheet__totals > div {
      min-width: 4.2rem;
      padding: 0.35rem 0.55rem;
      border-left: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
    }

    .manager-sheet__totals > div:first-child {
      border-left: 0;
    }

    .manager-sheet__totals > .is-sold {
      min-width: 7.6rem;
    }

    .manager-sheet__totals dt {
      color: var(--ui-text-subtle);
      font-size: 0.52rem;
      font-weight: 800;
      letter-spacing: 0.045em;
      line-height: 1.1;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .manager-sheet__totals dd {
      margin: 0.1rem 0 0;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 0.9rem;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .manager-sheet__totals .is-alert dd {
      color: var(--ui-danger);
    }

    .manager-sheet__totals .sold-metric {
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
    }

    .sold-metric > strong {
      font-family: var(--ui-font-display), sans-serif;
      font-size: 0.9rem;
      line-height: 1;
    }

    .sold-amounts {
      display: grid;
      gap: 0.08rem;
      color: var(--ui-text-muted);
      font-family: inherit;
      font-size: 0.52rem;
      font-weight: 750;
      line-height: 1.1;
      white-space: nowrap;
    }

    .manager-sheet__table-wrap {
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

    .status-group__heading {
      break-after: avoid-page;
    }

    .status-group__heading th {
      padding: 0.32rem 0.5rem;
      border-top: 1px solid var(--ui-border-strong);
      border-bottom: 1px solid var(--ui-border);
      border-left: 0.22rem solid var(--ui-action);
      background: color-mix(in srgb, var(--ui-action) 7%, var(--ui-surface-subtle));
      text-align: left;
    }

    .status-group__heading span {
      font-family: var(--ui-font-display), sans-serif;
      font-size: 0.76rem;
      font-weight: 850;
    }

    .status-group__heading small {
      margin-left: 0.5rem;
      color: var(--ui-text-subtle);
      font-size: 0.6rem;
      font-weight: 700;
    }

    @media (max-width: 62rem) {
      .manager-sheet__header {
        align-items: start;
        flex-direction: column;
      }

      .manager-sheet__totals {
        max-width: 100%;
        overflow-x: auto;
      }
    }

    @media print {
      :host:not(:first-child) {
        break-before: page;
      }

      .manager-sheet {
        border-color: #666;
        border-radius: 0;
        box-shadow: none;
        overflow: visible;
      }

      .manager-sheet__header {
        padding: 1.8mm 2mm;
        border-bottom-color: #111;
      }

      .manager-sheet__totals > div {
        min-width: 14mm;
        padding: 1mm 1.5mm;
        border-color: #aaa;
        background: #f4f4f4;
      }

      .manager-sheet__totals > .is-sold {
        min-width: 24mm;
      }

      .manager-sheet__totals .is-alert dd {
        color: #111;
      }

      .manager-sheet__table-wrap {
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

      .status-group__heading th {
        padding: 1mm 1.4mm;
        border-color: #888;
        border-left-color: #222;
        background: #f3f3f3;
      }
    }
  `,
})
export class ManagerReportSection {
  protected readonly i18n = inject(I18nService);
  readonly manager = input.required<ManagerLeadReport>();

  protected readonly managerName = computed(
    () => this.manager().managerName || this.i18n.t('common.noManager'),
  );
  protected readonly managerHeadingId = computed(
    () => `report-manager-${this.manager().managerId ?? this.manager().officeCode + '-unassigned'}`,
  );
  protected readonly statusGroups = computed((): readonly ReportStatusGroup[] =>
    STATUS_ORDER.map((status) => ({
      status,
      leads: this.manager().leads.filter((lead) => lead.clientStatus === status),
    })).filter((group) => group.leads.length > 0),
  );

  protected statusHeadingId(status: ClientStatus): string {
    return `${this.managerHeadingId()}-${status}`;
  }

  protected statusLabel(status: ClientStatus): string {
    if (status === 'new_lead') return this.i18n.t('reports.status.inWork');
    if (status === 'showroom_invited') return this.i18n.t('reports.status.awaitingShowroom');
    if (status === 'closed_lost') return this.i18n.t('reports.status.lost');
    return this.i18n.clientStatusLabel(status);
  }
}
