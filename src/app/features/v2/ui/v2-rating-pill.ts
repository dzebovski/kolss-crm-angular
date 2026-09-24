import { Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2LeadRating } from '@domain/v2/lead-view.types';
import { V2_RATING_LABEL } from './v2-tone';

// Rating pill (design system components/StatusPill, rating row): `rating-*` text and dot on
// `rating-*-bg`, no border. `md` = lead card header, `sm` = next to the name in the leads list
// (Main.dc.html, 22px). `null` = the lead card's "No rating" pill (`muted` on `surface-sunk`).
@Component({
  selector: 'app-v2-rating-pill',
  imports: [TranslatePipe],
  template: `
    <span class="v2-rating-pill__dot" aria-hidden="true"></span>
    {{ labelKey() | translate }}
  `,
  host: {
    '[attr.data-size]': 'size()',
    '[style.--v2-rating-pill-fg]': 'fg()',
    '[style.--v2-rating-pill-bg]': 'bg()',
  },
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      gap: 6px;
      box-sizing: border-box;
      height: 28px;
      padding: 0 var(--v2-space-3);
      background: var(--v2-rating-pill-bg);
      border-radius: var(--v2-radius-pill);
      color: var(--v2-rating-pill-fg);
      font-size: 13px;
      font-weight: 600;
      line-height: normal;
      white-space: nowrap;
    }

    :host([data-size='sm']) {
      height: 22px;
      padding: 0 var(--v2-space-2);
      font-size: 12px;
      font-weight: 500;
    }

    .v2-rating-pill__dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: var(--v2-radius-pill);
      background: var(--v2-rating-pill-fg);
    }

    :host([data-size='sm']) .v2-rating-pill__dot {
      width: 6px;
      height: 6px;
    }
  `,
})
export class V2RatingPill {
  readonly rating = input.required<V2LeadRating | null>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly labelKey = computed(() => {
    const rating = this.rating();
    return rating ? V2_RATING_LABEL[rating] : 'v2.rating.none';
  });
  protected readonly fg = computed(() => {
    const rating = this.rating();
    return rating ? `var(--v2-rating-${rating})` : 'var(--v2-muted)';
  });
  protected readonly bg = computed(() => {
    const rating = this.rating();
    return rating ? `var(--v2-rating-${rating}-bg)` : 'var(--v2-surface-sunk)';
  });
}
