import { Component, input } from '@angular/core';

import type { HrCellAbsenceType, HrEntryType } from '@core/api/generated/kolss-api.types';

/**
 * Stroke icon of an absence type (HR-components.dc.html, type icons). The board ships them as
 * image blobs; these are drawn to the same 24px grid. Colour comes from `currentColor`.
 */
@Component({
  selector: 'app-hr-type-icon',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24">
      @switch (type()) {
        @case ('vacation') {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        }
        @case ('sick') {
          <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
        }
        @case ('absent') {
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        }
        @case ('day_off_unpaid') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4M10 14l4 4M14 14l-4 4" />
        }
        @case ('day_off_makeup') {
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        }
        @case ('makeup_day') {
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4M9 15.5l2 2 4-4" />
        }
        @case ('remote') {
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        }
        @case ('occasional') {
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
        }
        @default {
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h.01M12 12h.01M16 12h.01" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class HrTypeIcon {
  readonly type = input.required<HrEntryType | HrCellAbsenceType>();
  readonly size = input(14);
}
