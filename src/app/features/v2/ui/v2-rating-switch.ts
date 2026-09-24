import { Component, input, output } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2LeadRating } from '@domain/v2/lead-view.types';
import { V2_RATING_LABEL } from './v2-tone';

interface RatingSegment {
  readonly value: V2LeadRating;
  readonly labelKey: (typeof V2_RATING_LABEL)[V2LeadRating];
}

const SEGMENTS: readonly RatingSegment[] = (['cold', 'medium', 'hot'] as const).map((value) => ({
  value,
  labelKey: V2_RATING_LABEL[value],
}));

// RatingSwitch (design system components/RatingSwitch; selected look from lead card v1.3,
// the reference: `rating-*-bg` fill + 1px ring of `rating-*` at 20%). Presentational: it emits
// the clicked rating and shows `value` as the server has it; the card saves and logs it.
@Component({
  selector: 'app-v2-rating-switch',
  imports: [TranslatePipe],
  template: `
    @for (segment of segments; track segment.value) {
      <button
        type="button"
        class="v2-rating-switch__segment"
        [class.v2-rating-switch__segment--selected]="segment.value === value()"
        [style.--v2-rating-switch-fg]="'var(--v2-rating-' + segment.value + ')'"
        [style.--v2-rating-switch-bg]="'var(--v2-rating-' + segment.value + '-bg)'"
        [attr.aria-pressed]="segment.value === value()"
        [disabled]="disabled()"
        (click)="ratingSelect.emit(segment.value)"
      >
        <span class="v2-rating-switch__dot" aria-hidden="true"></span>
        {{ segment.labelKey | translate }}
      </button>
    }
  `,
  host: { role: 'group', '[attr.aria-label]': 'ariaLabel()' },
  styles: `
    :host {
      display: inline-flex;
      gap: 3px;
      padding: 3px;
      background: var(--v2-ground);
      border-radius: var(--v2-radius-md);
    }

    // #55554f (unselected text) and the 34px / 7px segment are design values without a token.
    .v2-rating-switch__segment {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 14px;
      background: transparent;
      border: 0;
      border-radius: 7px;
      color: #55554f;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }

    .v2-rating-switch__segment--selected {
      background: var(--v2-rating-switch-bg);
      color: var(--v2-rating-switch-fg);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--v2-rating-switch-fg) 20%, transparent);
    }

    .v2-rating-switch__segment:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .v2-rating-switch__segment:focus-visible {
      outline: 2px solid var(--v2-ink);
      outline-offset: 2px;
    }

    .v2-rating-switch__dot {
      flex-shrink: 0;
      width: 7px;
      height: 7px;
      border-radius: var(--v2-radius-pill);
      background: var(--v2-rating-switch-fg);
    }
  `,
})
export class V2RatingSwitch {
  readonly value = input<V2LeadRating | null>(null);
  readonly ariaLabel = input.required<string>();
  readonly disabled = input(false);
  readonly ratingSelect = output<V2LeadRating>();

  protected readonly segments = SEGMENTS;
}
