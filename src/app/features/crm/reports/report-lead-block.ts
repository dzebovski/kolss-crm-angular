import { Component, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { callStatusTone, clientStatusTone } from '../../../services/crm-mock.helpers';
import type { ClientStatus } from '../../../services/crm-mock.types';
import { UiBadge } from '../../../ui/feedback/ui-badge';
import type { ReportLead } from './reports.types';

@Component({
  // A tbody host keeps each two-row lead block valid and repeatable inside a semantic table.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tbody[appReportLeadBlock]',
  imports: [UiBadge],
  host: { class: 'report-lead-block' },
  template: `
    <tr class="lead-summary-row">
      <td class="lead-identity">
        <strong>{{ lead().name || i18n.t('common.unknown') }}</strong>
        <span>{{ lead().phone || '—' }}</span>
        <small>{{ i18n.t('reports.createdAt') }}: {{ i18n.formatDate(lead().createdAt) }}</small>
      </td>
      <td>
        <app-ui-badge [tone]="clientStatusTone(lead().clientStatus)">
          {{ statusLabel(lead().clientStatus) }}
        </app-ui-badge>
      </td>
      <td>
        @if (lead().callStatus; as callStatus) {
          <app-ui-badge [tone]="callStatusTone(callStatus)">
            {{ i18n.callStatusLabel(callStatus) }}
          </app-ui-badge>
        } @else {
          <span class="muted">—</span>
        }
      </td>
      <td class="lead-activity">
        @if (lead().lastHumanActivityAt) {
          <strong>{{ i18n.formatDateTime(lead().lastHumanActivityAt) }}</strong>
        } @else {
          <strong>{{ i18n.t('reports.noHumanActivity') }}</strong>
        }
        <span [class.is-stale]="lead().inactive7d">
          {{ i18n.t('reports.daysWithoutActivity', { count: lead().inactiveDays }) }}
        </span>
      </td>
      <td class="lead-loss-reason">
        @if (lead().lossReason; as reason) {
          <strong>{{ i18n.closeReasonLabel(reason) }}</strong>
        } @else {
          <span class="muted">—</span>
        }
      </td>
    </tr>
    <tr class="lead-comments-row">
      <td colspan="5">
        <div class="comment-stack">
          @for (comment of lead().comments; track comment.occurredAt + comment.authorId) {
            <article class="comment-item">
              <header>
                <strong>{{ comment.authorName || i18n.t('common.unknown') }}</strong>
                <time [attr.datetime]="comment.occurredAt">
                  {{ i18n.formatDateTime(comment.occurredAt) }}
                </time>
              </header>
              <p>{{ comment.body }}</p>
            </article>
          } @empty {
            <p class="no-comments">{{ i18n.t('reports.noMeaningfulComments') }}</p>
          }
        </div>
      </td>
    </tr>
  `,
  styles: `
    :host {
      break-inside: avoid-page;
    }

    td {
      padding: 0.8rem 0.9rem;
      border-top: 1px solid var(--ui-border);
      vertical-align: top;
      text-align: left;
    }

    .lead-summary-row td {
      background: var(--ui-surface-raised);
    }

    .lead-identity {
      min-width: 12rem;
    }

    .lead-identity strong,
    .lead-identity span,
    .lead-identity small,
    .lead-activity strong,
    .lead-activity span {
      display: block;
    }

    .lead-identity strong {
      color: var(--ui-text);
      font-size: 0.9rem;
    }

    .lead-identity span {
      margin-top: 0.1rem;
      font-variant-numeric: tabular-nums;
    }

    .lead-identity small,
    .lead-activity span,
    .muted {
      color: var(--ui-text-subtle);
      font-size: 0.72rem;
    }

    .lead-activity strong,
    .lead-loss-reason strong {
      font-size: 0.78rem;
    }

    .lead-activity .is-stale {
      color: var(--ui-danger);
      font-weight: 750;
    }

    .lead-comments-row td {
      padding-top: 0;
      background: var(--ui-surface-subtle);
    }

    .comment-stack {
      margin-left: 1rem;
      padding: 0.65rem 0 0.1rem 0.9rem;
      border-left: 2px solid var(--ui-border-strong);
      display: grid;
      gap: 0.65rem;
    }

    .comment-item {
      min-width: 0;
    }

    .comment-item header {
      display: flex;
      gap: 0.65rem;
      align-items: baseline;
      color: var(--ui-text-subtle);
      font-size: 0.7rem;
    }

    .comment-item header strong {
      color: var(--ui-text-muted);
    }

    .comment-item p,
    .no-comments {
      margin: 0.2rem 0 0;
      color: var(--ui-text);
      font-size: 0.82rem;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .no-comments {
      color: var(--ui-text-subtle);
      font-style: italic;
    }

    @media print {
      td {
        padding: 2.2mm 2.5mm;
        border-color: #b8b8b8;
      }

      .lead-summary-row td,
      .lead-comments-row td {
        background: white;
      }

      .comment-stack {
        border-left-color: #777;
      }

      .lead-activity .is-stale {
        color: #a00000;
      }
    }
  `,
})
export class ReportLeadBlock {
  protected readonly i18n = inject(I18nService);
  readonly lead = input.required<ReportLead>();
  protected readonly callStatusTone = callStatusTone;
  protected readonly clientStatusTone = clientStatusTone;

  protected statusLabel(status: ClientStatus): string {
    if (status === 'new_lead') return this.i18n.t('reports.status.inWork');
    if (status === 'showroom_invited') return this.i18n.t('reports.status.awaitingShowroom');
    if (status === 'closed_lost') return this.i18n.t('reports.status.lost');
    return this.i18n.clientStatusLabel(status);
  }
}
