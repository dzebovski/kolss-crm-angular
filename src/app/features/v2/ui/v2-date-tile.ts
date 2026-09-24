import { Component, input } from '@angular/core';

export type V2DateTileTone = 'default' | 'today' | 'overdue';

// Date tile from lead card v1.3 (Reminders & tasks): 44px square, weekday over day number.
// `today` = `ink` fill, `overdue` = `danger` on `danger-bg`, otherwise `surface-sunk`. The
// consumer decides the tone and formats the weekday (short, in the UI language; shown
// uppercase). Decorative: the row next to it carries the date as text, so it's hidden from
// assistive tech.
@Component({
  selector: 'app-v2-date-tile',
  template: `
    <span class="v2-date-tile__weekday">{{ weekday() }}</span>
    <span class="v2-date-tile__day">{{ day() }}</span>
  `,
  host: { 'aria-hidden': 'true', '[attr.data-tone]': 'tone()' },
  styles: `
    :host {
      display: flex;
      flex-shrink: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--v2-radius-md);
      background: var(--v2-surface-sunk);
      color: var(--v2-ink);
    }

    :host([data-tone='today']) {
      background: var(--v2-ink);
      color: var(--v2-on-ink);
    }

    :host([data-tone='overdue']) {
      background: var(--v2-danger-bg);
      color: var(--v2-danger);
    }

    .v2-date-tile__weekday {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .v2-date-tile__day {
      font-size: 16px;
      font-weight: 600;
      line-height: 1;
    }
  `,
})
export class V2DateTile {
  readonly weekday = input.required<string>();
  readonly day = input.required<number | string>();
  readonly tone = input<V2DateTileTone>('default');
}
