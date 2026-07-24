import { Component, inject, input, output } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { MockLead } from '../../../services/crm-mock.types';
import { UiIcon } from '../../../ui/icon/ui-icon';

export type CalendarReminderKind = 'callback' | 'comment';

export interface CalendarReminder {
  readonly kind: CalendarReminderKind;
  /** Office-local day bucket (YYYY-MM-DD) the reminder is due on. */
  readonly date: string;
  readonly lead: MockLead;
}

/**
 * Compact, date-only lead reminder chips rendered at the top of a calendar day.
 * Blue phone chips flag pending callbacks, orange chips flag comment follow-ups.
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
        [class.is-comment]="reminder.kind === 'comment'"
        [attr.aria-label]="ariaLabel(reminder)"
        (click)="leadSelected.emit(reminder.lead)"
      >
        <app-ui-icon
          [name]="reminder.kind === 'callback' ? 'phone_in_talk' : 'schedule'"
          [size]="13"
        />
        <span class="reminder-name">{{ reminder.lead.name || reminder.lead.phone }}</span>
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

    .is-comment {
      border-color: color-mix(in srgb, var(--ui-warning) 35%, var(--ui-border));
      border-left-color: var(--ui-warning);
      background: color-mix(in srgb, var(--ui-warning) 12%, var(--ui-surface-raised));
    }

    .is-comment app-ui-icon {
      color: var(--ui-warning);
    }
  `,
})
export class CalendarDayReminders {
  private readonly i18n = inject(I18nService);

  readonly reminders = input.required<readonly CalendarReminder[]>();
  readonly leadSelected = output<MockLead>();

  protected ariaLabel(reminder: CalendarReminder): string {
    const name = reminder.lead.name || reminder.lead.phone;
    return this.i18n.t(
      reminder.kind === 'callback' ? 'calendar.reminderCallback' : 'calendar.reminderComment',
      { name },
    );
  }
}
