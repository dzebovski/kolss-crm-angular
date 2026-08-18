import { Component, inject, input, output } from '@angular/core';

import type { MessageKey } from '@core/i18n/messages';
import { I18nService } from '@core/i18n/i18n.service';
import type { LeadReminderKind } from '@domain/lead.rules';
import type { Lead } from '@domain/lead.types';
import { UiIcon, type UiIconName } from '@ui/icon/ui-icon';

/** One reminder due before today — one row per reminder, never grouped by lead. */
export interface CalendarOverdueRow {
  readonly kind: LeadReminderKind;
  readonly lead: Lead;
  /** Raw due instant, kept for stable chronological sorting. */
  readonly dueAt: string;
  /** Office-local, already locale-formatted (e.g. "23 лип"). */
  readonly dateLabel: string;
  /** Office-local time (HH:mm). */
  readonly timeLabel: string;
  /** Comment-task assignee display name, when the reminder has one. */
  readonly assigneeName: string | null;
}

const KIND_ICON: Record<LeadReminderKind, UiIconName> = {
  callback: 'phone_in_talk',
  thinking: 'info',
  comment: 'schedule',
  showroom: 'calendar_month',
  measurement: 'straighten',
};

/**
 * Flat list of every overdue reminder across all days — the `due=overdue`
 * digest group has no single day to bucket into, so it gets its own list
 * instead of a calendar grid. Loading/error states are the caller's
 * responsibility (mirrors how `calendar-page.html` already gates its grid).
 */
@Component({
  selector: 'app-calendar-overdue-list',
  imports: [UiIcon],
  template: `
    <div class="overdue-list" aria-live="polite">
      @if (!rows().length) {
        <p class="overdue-empty">{{ i18n.t('calendar.overdue.empty') }}</p>
      } @else {
        <ul class="overdue-rows">
          @for (row of rows(); track row.lead.id + '-' + row.kind) {
            <li>
              <button
                type="button"
                [class]="'overdue-row is-' + row.kind"
                (click)="leadSelected.emit(row.lead)"
              >
                <app-ui-icon [name]="iconFor(row)" [size]="18" />
                <span class="overdue-main">
                  <strong>{{ row.lead.name || row.lead.phone }}</strong>
                  <small>
                    {{ kindLabel(row) }}
                    @if (row.assigneeName) {
                      · {{ row.assigneeName }}
                    }
                  </small>
                </span>
                <span class="overdue-due">{{ row.dateLabel }} · {{ row.timeLabel }}</span>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .overdue-list {
      display: block;
    }

    .overdue-rows {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: var(--ui-space-2);
    }

    .overdue-row {
      width: 100%;
      padding: var(--ui-space-3);
      border: 1px solid var(--ui-border);
      border-left: 4px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      color: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
      text-align: left;
      box-shadow: var(--ui-shadow-1);
    }

    .overdue-row:hover {
      background: var(--ui-surface-muted);
    }

    .overdue-row:focus-visible {
      outline: 2px solid var(--ui-action);
      outline-offset: 2px;
    }

    .overdue-main {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 0.15rem;

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        color: var(--ui-text-muted);
      }
    }

    .overdue-due {
      flex: 0 0 auto;
      color: var(--ui-text-subtle);
      font-size: 0.8125rem;
      font-weight: 650;
      white-space: nowrap;
    }

    .overdue-empty {
      margin: var(--ui-space-5) 0;
      color: var(--ui-text-muted);
      text-align: center;
    }

    .is-callback {
      border-left-color: var(--ui-info);

      app-ui-icon {
        color: var(--ui-info);
      }
    }

    .is-thinking,
    .is-measurement {
      border-left-color: var(--ui-teal);

      app-ui-icon {
        color: var(--ui-teal);
      }
    }

    .is-comment {
      border-left-color: var(--ui-warning);

      app-ui-icon {
        color: var(--ui-warning);
      }
    }

    .is-showroom {
      border-left-color: var(--ui-action);

      app-ui-icon {
        color: var(--ui-action);
      }
    }
  `,
})
export class CalendarOverdueList {
  protected readonly i18n = inject(I18nService);

  readonly rows = input.required<readonly CalendarOverdueRow[]>();
  readonly leadSelected = output<Lead>();

  protected iconFor(row: CalendarOverdueRow): UiIconName {
    return KIND_ICON[row.kind];
  }

  protected kindLabel(row: CalendarOverdueRow): string {
    return this.i18n.t(`calendar.kind.${row.kind}` as MessageKey);
  }
}
