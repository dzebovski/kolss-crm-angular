import { Component, computed, inject, input } from '@angular/core';

import type { HrCellView } from '@domain/hr/hr-calendar';
import { hoursLabel, shortTime } from '@domain/hr/hr-dates';
import { HrText } from '../hr-text';
import { HrTypeIcon } from './hr-type-icon';

/**
 * 44×44 day cell of the month grid (HR-components.dc.html, Day cell): flexible `10` over `–14`,
 * fixed `8h`, off `–`, holiday icon, absence icon, half-day fill (top = 1st half), make-up
 * `mk`, today outline, past muted, closed month with a lock. The host is the button.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appHrDayCell]',
  imports: [HrTypeIcon],
  host: {
    type: 'button',
    class: 'hr-cell',
    '[attr.data-kind]': 'view().kind',
    '[attr.data-type]': 'view().absence?.type ?? null',
    '[attr.data-half]': 'view().half',
    '[class.hr-cell--today]': 'view().today',
    '[class.hr-cell--past]': 'view().past',
    '[class.hr-cell--selected]': 'selected()',
    '[class.hr-cell--makeup]': 'view().makeup',
    '[attr.aria-label]': 'label()',
    '[attr.aria-pressed]': 'selected()',
  },
  template: `
    @switch (view().kind) {
      @case ('closed') {
        @if (view().holiday) {
          <svg class="hr-cell__icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
          </svg>
        } @else {
          <span class="hr-cell__dash" aria-hidden="true">–</span>
        }
      }
      @case ('absence') {
        @if (view().half) {
          <span class="hr-cell__fill" aria-hidden="true"></span>
          <span class="hr-cell__hours" aria-hidden="true">{{ hoursText() }}</span>
        } @else {
          <app-hr-type-icon [type]="view().absence!.type" [size]="16" />
        }
      }
      @case ('hours') {
        @if (view().flexible) {
          <span class="hr-cell__start" aria-hidden="true">{{ startText() }}</span>
          <span class="hr-cell__end" aria-hidden="true">–{{ endText() }}</span>
        } @else {
          <span class="hr-cell__hours" aria-hidden="true">{{ hoursText() }}</span>
        }
      }
      @default {
        <span class="hr-cell__dash" aria-hidden="true">–</span>
      }
    }
    @if (view().makeup) {
      <span class="hr-cell__mk" aria-hidden="true">mk</span>
    }
    @if (locked()) {
      <svg class="hr-cell__lock" width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    }
  `,
  styleUrl: './hr-day-cell.scss',
})
export class HrDayCell {
  private readonly text = inject(HrText);

  readonly view = input.required<HrCellView>();
  readonly label = input.required<string>();
  readonly selected = input(false);
  /** Show the lock of a closed month (My time and the employee calendar). */
  readonly locked = input(false);

  protected readonly startText = computed(() => shortTime(this.view().start));
  protected readonly endText = computed(() => shortTime(this.view().end));
  protected readonly hoursText = computed(() => {
    const minutes = this.view().minutes;
    return minutes > 0 ? `${this.text.number(Number(hoursLabel(minutes)))}h` : '';
  });
}
