import { Component, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { ClientStatus } from '../../../services/crm-mock.types';
import { LinkifiedText } from '../../../ui/text/linkified-text';
import type { ReportLead } from './reports.types';

@Component({
  // A tr host keeps every lead as one semantic, printable table row.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tr[appReportLeadBlock]',
  host: { class: 'report-lead-block' },
  imports: [LinkifiedText],
  template: `
    <td class="lead-date">
      <time [attr.datetime]="lead().createdAt">{{ i18n.formatDate(lead().createdAt) }}</time>
    </td>
    <th class="lead-identity" scope="row">
      <strong>{{ lead().name || i18n.t('common.unknown') }}</strong>
      <span>{{ lead().phone || '—' }}</span>
    </th>
    <td class="lead-call-status">
      @if (lead().callStatus; as callStatus) {
        <strong>{{ i18n.callStatusLabel(callStatus) }}</strong>
      } @else {
        <span class="empty-value">—</span>
      }
    </td>
    <td class="lead-client-status">
      <strong>{{ statusLabel(lead().clientStatus) }}</strong>
      @if (lead().lossReason; as reason) {
        <span>{{ i18n.closeReasonLabel(reason) }}</span>
      }
      @if (lead().inactive7d) {
        <span class="is-stale">
          {{ i18n.t('reports.daysWithoutActivity', { count: lead().inactiveDays }) }}
        </span>
      }
    </td>
    <td class="lead-comment">
      @if (lead().comments[0]; as latestComment) {
        <article class="comment-item">
          <header>
            <strong>{{ latestComment.authorName || i18n.t('common.unknown') }}</strong>
            <time [attr.datetime]="latestComment.occurredAt">
              {{ i18n.formatDateTime(latestComment.occurredAt) }}
            </time>
          </header>
          <p><app-linkified-text [text]="latestComment.body" /></p>
        </article>
      } @else {
        <span class="empty-value">—</span>
      }
    </td>
    <td class="lead-comment">
      @if (lead().comments[1]; as previousComment) {
        <article class="comment-item">
          <header>
            <strong>{{ previousComment.authorName || i18n.t('common.unknown') }}</strong>
            <time [attr.datetime]="previousComment.occurredAt">
              {{ i18n.formatDateTime(previousComment.occurredAt) }}
            </time>
          </header>
          <p><app-linkified-text [text]="previousComment.body" /></p>
        </article>
      } @else {
        <span class="empty-value">—</span>
      }
    </td>
  `,
  styles: `
    :host {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }

    td,
    th {
      padding: 0.45rem 0.5rem;
      border-top: 1px solid var(--ui-border);
      border-right: 1px solid var(--ui-border);
      background: var(--ui-surface-raised);
      font-size: 0.68rem;
      font-weight: 400;
      line-height: 1.28;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    td:last-child {
      border-right: 0;
    }

    .lead-date time,
    .lead-identity span {
      font-variant-numeric: tabular-nums;
    }

    .lead-date time {
      white-space: nowrap;
    }

    .lead-identity strong,
    .lead-identity span,
    .lead-call-status strong,
    .lead-client-status strong,
    .lead-client-status span {
      display: block;
    }

    .lead-identity strong,
    .lead-call-status strong,
    .lead-client-status strong {
      color: var(--ui-text);
      font-size: 0.7rem;
      font-weight: 750;
    }

    .lead-identity span,
    .lead-client-status span,
    .empty-value {
      margin-top: 0.1rem;
      color: var(--ui-text-subtle);
      font-size: 0.63rem;
    }

    .lead-client-status .is-stale {
      color: var(--ui-danger);
      font-weight: 750;
    }

    .comment-item {
      min-width: 0;
    }

    .comment-item header {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.1rem 0.35rem;
      color: var(--ui-text-subtle);
      font-size: 0.58rem;
      line-height: 1.15;
    }

    .comment-item header strong {
      color: var(--ui-text-muted);
      font-weight: 800;
    }

    .comment-item time {
      font-variant-numeric: tabular-nums;
    }

    .comment-item p {
      margin: 0.16rem 0 0;
      color: var(--ui-text);
      font-size: 0.68rem;
      line-height: 1.3;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    @media print {
      td,
      th {
        padding: 1.2mm 1.4mm;
        border-color: #aaa;
        background: white;
        font-size: 6.7pt;
        line-height: 1.22;
      }

      .lead-identity strong,
      .lead-call-status strong,
      .lead-client-status strong,
      .comment-item p {
        font-size: 6.7pt;
      }

      .lead-identity span,
      .lead-client-status span,
      .comment-item header,
      .empty-value {
        font-size: 5.8pt;
      }

      .lead-client-status .is-stale {
        color: #111;
      }
    }
  `,
})
export class ReportLeadBlock {
  protected readonly i18n = inject(I18nService);
  readonly lead = input.required<ReportLead>();

  protected statusLabel(status: ClientStatus): string {
    if (status === 'new_lead') return this.i18n.t('reports.status.inWork');
    if (status === 'showroom_invited') return this.i18n.t('reports.status.awaitingShowroom');
    if (status === 'closed_lost') return this.i18n.t('reports.status.lost');
    return this.i18n.clientStatusLabel(status);
  }
}
