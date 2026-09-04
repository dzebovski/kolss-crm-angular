import { Component, input, output } from '@angular/core';

import type { LeadReminderKind } from '@domain/lead.rules';
import type { Lead } from '@domain/lead.types';
import {
  CalendarEventCard,
  type CalendarEventCardDensity,
  type CalendarEventCardModel,
} from './calendar-event-card';

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
  /** Manager displayed in the footer: task assignee first, otherwise lead owner. */
  readonly managerName: string;
}

export function calendarReminderCardModel(reminder: CalendarReminder): CalendarEventCardModel {
  return {
    kind: reminder.kind === 'comment' && reminder.assigneeId ? 'task' : reminder.kind,
    time: null,
    lead: reminder.lead,
    managerName: reminder.managerName,
    comment: null,
    status: null,
    hasWarning: false,
  };
}

/**
 * Date-only lead reminders rendered with the same presentation component as
 * timed appointments. Placement stays owned by the calendar page: reminders
 * remain in all-day/banner sections and never fabricate a time.
 */
@Component({
  selector: 'app-calendar-day-reminders',
  imports: [CalendarEventCard],
  template: `
    @for (reminder of reminders(); track reminder.lead.id + '-' + reminder.kind) {
      <button
        type="button"
        class="calendar-event-button reminder-card reminder-chip"
        [class.is-callback]="reminder.kind === 'callback'"
        [class.is-thinking]="reminder.kind === 'thinking'"
        [class.is-postponed]="reminder.kind === 'postponed'"
        [class.is-comment]="reminder.kind === 'comment' && !reminder.assigneeId"
        [class.is-task]="reminder.kind === 'comment' && !!reminder.assigneeId"
        [attr.data-kind]="cardFor(reminder).kind"
        (click)="leadSelected.emit(reminder.lead)"
      >
        <app-calendar-event-card [event]="cardFor(reminder)" [density]="density()" />
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

    .calendar-event-button {
      width: 100%;
      align-self: stretch;
      min-width: 0;
      min-height: 5.75rem;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }

    .calendar-event-button:hover {
      --calendar-event-border: var(--ui-border-strong);
      --calendar-event-shadow: 0 0.35rem 0.9rem color-mix(in srgb, var(--ui-text) 12%, transparent);
    }

    .calendar-event-button:focus-visible {
      outline: 2px solid var(--ui-action);
      outline-offset: 2px;
    }
  `,
})
export class CalendarDayReminders {
  readonly reminders = input.required<readonly CalendarReminder[]>();
  readonly density = input<CalendarEventCardDensity>('full');
  readonly leadSelected = output<Lead>();

  protected cardFor(reminder: CalendarReminder): CalendarEventCardModel {
    return calendarReminderCardModel(reminder);
  }
}
