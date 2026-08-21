import { Component, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { LeadReminderKind } from '@domain/lead.rules';
import type { Lead } from '@domain/lead.types';
import { UiIcon, type UiIconName } from '@ui/icon/ui-icon';

/**
 * Chip-rendered reminder kinds — the canonical `LeadReminderKind`
 * (`@domain/lead.rules`) minus `showroom`/`measurement`, which never appear
 * here (see `calendar-page.ts`'s `remindersByDate`). "Task" is not a separate
 * kind: it's a display nuance of a `comment` reminder that has an assignee
 * (`assigneeId` set), not a filter dimension — see `isTask()` below.
 */
export type CalendarReminderKind = Exclude<LeadReminderKind, 'showroom' | 'measurement'>;

export interface CalendarReminder {
  readonly kind: CalendarReminderKind;
  /** Office-local day bucket (YYYY-MM-DD) the reminder is due on. */
  readonly date: string;
  readonly lead: Lead;
  /** Task assignee uuid (kind === 'comment' with an assignee). */
  readonly assigneeId?: string | null;
  /** Task assignee display name (kind === 'comment' with an assignee). */
  readonly assigneeName?: string | null;
}

/**
 * Compact, date-only lead reminder chips rendered at the top of a calendar day.
 * Blue phone chips flag pending callbacks, teal flag client-status "thinking"
 * (negotiating) reminders, grey flag "postponed" reminders, orange chips flag
 * comment follow-ups (a violet accent + assignee name marks the ones with a
 * task assignee).
 */
@Component({
  selector: 'app-calendar-day-reminders',
  imports: [UiIcon],
  template: `
    @for (reminder of reminders(); track reminder.lead.id + '-' + reminder.kind) {
      <button
        type="button"
        class="reminder-chip"
        [class.is-callback]="reminder.kind === 'callback'"
        [class.is-thinking]="reminder.kind === 'thinking'"
        [class.is-postponed]="reminder.kind === 'postponed'"
        [class.is-comment]="reminder.kind === 'comment' && !isTask(reminder)"
        [class.is-task]="isTask(reminder)"
        [attr.aria-label]="ariaLabel(reminder)"
        (click)="leadSelected.emit(reminder.lead)"
      >
        <app-ui-icon [name]="iconFor(reminder)" [size]="13" />
        <span class="reminder-name">{{ reminder.lead.name || reminder.lead.phone }}</span>
        @if (showAssignee() && isTask(reminder) && reminder.assigneeName) {
          <span class="reminder-assignee">{{ reminder.assigneeName }}</span>
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 0.25rem;
      min-width: 0;
    }

    .reminder-chip {
      width: 100%;
      align-self: stretch;
      min-width: 0;
      padding: 0.15rem 0.4rem;
      border: 1px solid var(--ui-border);
      border-left: 3px solid var(--ui-border);
      border-radius: var(--ui-radius-sm);
      background: var(--ui-surface-raised);
      color: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font: inherit;
      font-size: 0.7rem;
      font-weight: 650;
      line-height: 1.3;
      text-align: left;
    }

    .reminder-chip app-ui-icon {
      flex: 0 0 auto;
    }

    .reminder-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reminder-chip:focus-visible {
      outline: 2px solid var(--ui-action);
      outline-offset: 1px;
    }

    .is-callback {
      border-color: color-mix(in srgb, var(--ui-info) 35%, var(--ui-border));
      border-left-color: var(--ui-info);
      background: color-mix(in srgb, var(--ui-info) 10%, var(--ui-surface-raised));
    }

    .is-callback app-ui-icon {
      color: var(--ui-info);
    }

    .is-thinking {
      border-color: color-mix(in srgb, var(--ui-teal) 35%, var(--ui-border));
      border-left-color: var(--ui-teal);
      background: color-mix(in srgb, var(--ui-teal) 10%, var(--ui-surface-raised));
    }

    .is-thinking app-ui-icon {
      color: var(--ui-teal);
    }

    .is-postponed {
      border-color: color-mix(in srgb, var(--ui-neutral) 35%, var(--ui-border));
      border-left-color: var(--ui-neutral);
      background: color-mix(in srgb, var(--ui-neutral) 10%, var(--ui-surface-raised));
    }

    .is-postponed app-ui-icon {
      color: var(--ui-neutral);
    }

    .is-comment {
      border-color: color-mix(in srgb, var(--ui-warning) 35%, var(--ui-border));
      border-left-color: var(--ui-warning);
      background: color-mix(in srgb, var(--ui-warning) 12%, var(--ui-surface-raised));
    }

    .is-comment app-ui-icon {
      color: var(--ui-warning);
    }

    .is-task {
      border-color: color-mix(in srgb, var(--ui-action) 38%, var(--ui-border));
      border-left-color: var(--ui-action);
      background: color-mix(in srgb, var(--ui-action) 10%, var(--ui-surface-raised));
    }

    .is-task app-ui-icon {
      color: var(--ui-action);
    }

    .reminder-assignee {
      flex: 0 0 auto;
      max-width: 45%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ui-text-subtle);
      font-weight: 600;
    }
  `,
})
export class CalendarDayReminders {
  private readonly i18n = inject(I18nService);

  readonly reminders = input.required<readonly CalendarReminder[]>();
  /** Show the task assignee name alongside the lead (used outside per-manager columns). */
  readonly showAssignee = input(false);
  readonly leadSelected = output<Lead>();

  /** A comment reminder with an assignee renders as a "task" — see the type doc above. */
  protected isTask(reminder: CalendarReminder): boolean {
    return reminder.kind === 'comment' && !!reminder.assigneeId;
  }

  protected iconFor(reminder: CalendarReminder): UiIconName {
    if (reminder.kind === 'callback') return 'phone_in_talk';
    if (this.isTask(reminder)) return 'person';
    if (reminder.kind === 'thinking') return 'info';
    if (reminder.kind === 'postponed') return 'history';
    return 'schedule';
  }

  protected ariaLabel(reminder: CalendarReminder): string {
    const name = reminder.lead.name || reminder.lead.phone;
    if (reminder.kind === 'callback') return this.i18n.t('calendar.reminderCallback', { name });
    if (this.isTask(reminder)) return this.i18n.t('calendar.reminderTask', { name });
    if (reminder.kind === 'thinking') return this.i18n.t('calendar.reminderThinking', { name });
    if (reminder.kind === 'postponed') return this.i18n.t('calendar.reminderPostponed', { name });
    return this.i18n.t('calendar.reminderComment', { name });
  }
}
