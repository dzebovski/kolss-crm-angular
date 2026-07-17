import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { ClientStatus } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';
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
  imports: [ReportLeadBlock, UiBadge],
  host: { class: 'manager-report-host' },
  template: `
    <section class="manager-sheet" [attr.aria-labelledby]="managerHeadingId()">
      <header class="manager-sheet__header">
        <div>
          <p class="manager-sheet__kicker">
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
          <div>
            <dt>{{ i18n.t('reports.metric.sold') }}</dt>
            <dd>{{ manager().totals.contractSigned }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('reports.metric.lost') }}</dt>
            <dd>{{ manager().totals.closedLost }}</dd>
          </div>
          <div class="is-alert">
            <dt>{{ i18n.t('reports.metric.inactive') }}</dt>
            <dd>{{ manager().totals.inactive7d }}</dd>
          </div>
        </dl>
      </header>

      <div class="manager-sheet__groups">
        @for (group of statusGroups(); track group.status) {
          <section class="status-section" [attr.aria-labelledby]="statusHeadingId(group.status)">
            <header class="status-section__header">
              <h3 [id]="statusHeadingId(group.status)">{{ statusLabel(group.status) }}</h3>
              <app-ui-badge tone="neutral">
                {{ i18n.t('reports.leadCount', { count: group.leads.length }) }}
              </app-ui-badge>
            </header>

            <div class="status-table-wrap">
              <table class="lead-report-table">
                <thead>
                  <tr>
                    <th scope="col">{{ i18n.t('reports.column.lead') }}</th>
                    <th scope="col">{{ i18n.t('reports.column.clientStatus') }}</th>
                    <th scope="col">{{ i18n.t('reports.column.callStatus') }}</th>
                    <th scope="col">{{ i18n.t('reports.column.activity') }}</th>
                    <th scope="col">{{ i18n.t('reports.column.lossReason') }}</th>
                  </tr>
                </thead>
                @for (lead of group.leads; track lead.id) {
                  <tbody appReportLeadBlock [lead]="lead"></tbody>
                }
              </table>
            </div>
          </section>
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .manager-sheet {
      min-width: 0;
      padding: clamp(1.1rem, 2.5vw, 2rem);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-1);
    }

    .manager-sheet__header {
      display: grid;
      grid-template-columns: minmax(15rem, 1fr) auto;
      gap: var(--ui-space-6);
      align-items: end;
      padding-bottom: var(--ui-space-5);
      border-bottom: 2px solid var(--ui-text);
    }

    .manager-sheet__kicker {
      margin: 0 0 0.25rem;
      color: var(--ui-action);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    h2,
    h3 {
      margin: 0;
      font-family: var(--ui-font-display), sans-serif;
    }

    h2 {
      font-size: clamp(1.55rem, 3vw, 2.25rem);
      line-height: 1;
    }

    .manager-sheet__totals {
      margin: 0;
      display: flex;
      gap: 0;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      overflow: hidden;
    }

    .manager-sheet__totals div {
      min-width: 5.3rem;
      padding: 0.55rem 0.75rem;
      border-left: 1px solid var(--ui-border);
      background: var(--ui-surface-subtle);
    }

    .manager-sheet__totals div:first-child {
      border-left: 0;
    }

    .manager-sheet__totals dt {
      color: var(--ui-text-subtle);
      font-size: 0.62rem;
      font-weight: 750;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .manager-sheet__totals dd {
      margin: 0.15rem 0 0;
      font-family: var(--ui-font-display), sans-serif;
      font-size: 1.25rem;
      font-weight: 800;
    }

    .manager-sheet__totals .is-alert dd {
      color: var(--ui-danger);
    }

    .manager-sheet__groups {
      margin-top: var(--ui-space-6);
      display: grid;
      gap: var(--ui-space-6);
    }

    .status-section {
      min-width: 0;
      break-inside: auto;
    }

    .status-section__header {
      min-height: 2.5rem;
      padding: 0 var(--ui-space-3);
      border-left: 0.3rem solid var(--ui-action);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
      background: var(--ui-surface-subtle);
    }

    .status-section__header h3 {
      font-size: 1rem;
    }

    .status-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--ui-border);
      border-top: 0;
    }

    .lead-report-table {
      width: 100%;
      min-width: 56rem;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .lead-report-table th {
      padding: 0.55rem 0.9rem;
      background: var(--ui-surface-muted);
      color: var(--ui-text-subtle);
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-align: left;
      text-transform: uppercase;
    }

    .lead-report-table th:nth-child(1) {
      width: 24%;
    }

    .lead-report-table th:nth-child(2),
    .lead-report-table th:nth-child(3) {
      width: 16%;
    }

    .lead-report-table th:nth-child(4) {
      width: 25%;
    }

    .lead-report-table th:nth-child(5) {
      width: 19%;
    }

    @media (max-width: 62rem) {
      .manager-sheet__header {
        grid-template-columns: 1fr;
      }

      .manager-sheet__totals {
        width: 100%;
        overflow-x: auto;
      }

      .manager-sheet__totals div {
        flex: 1 0 auto;
      }
    }

    @media print {
      :host {
        break-before: page;
      }

      .manager-sheet {
        padding: 0;
        border: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .manager-sheet__header {
        padding-bottom: 3mm;
        border-bottom-color: #111;
      }

      .manager-sheet__totals div,
      .status-section__header,
      .lead-report-table th {
        background: #f1f1f1;
      }

      .manager-sheet__groups {
        margin-top: 5mm;
        gap: 5mm;
      }

      .status-section__header {
        border-left-color: #222;
      }

      .status-table-wrap {
        overflow: visible;
        border-color: #999;
      }

      .lead-report-table {
        min-width: 0;
      }

      .lead-report-table thead {
        display: table-header-group;
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
