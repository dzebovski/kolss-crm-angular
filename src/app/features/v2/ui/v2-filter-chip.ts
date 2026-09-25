import { Component, computed, input } from '@angular/core';

import { v2ToneColor, type V2Tone } from './v2-tone';

// Filter chip with a count from the Leads board (Main.dc.html, CHIP / CHIP_ON / CHIP_OFF):
// toggles between `surface` + `line-strong` and an `ink` fill. The label is projected.
@Component({
  // Attribute selector on the native element keeps button/link semantics, `type`, `disabled`
  // and `routerLink` without forwarding them.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appV2FilterChip]',
  template: `
    @if (dotColor(); as color) {
      <span class="v2-filter-chip__dot" [style.background]="color" aria-hidden="true"></span>
    }
    <ng-content />
    @if (count() !== null) {
      <span class="v2-filter-chip__count">{{ count() }}</span>
    }
  `,
  host: {
    '[class.v2-filter-chip--selected]': 'selected()',
    '[attr.aria-pressed]': 'selected()',
  },
  styles: `
    @use '../../../../styles/v2/interactive';

    :host {
      display: flex;
      align-items: center;
      gap: var(--v2-space-2);
      box-sizing: border-box;
      height: var(--v2-control-sm);
      padding: 0 var(--v2-space-3);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-pill);
      color: var(--v2-ink);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      line-height: normal;
      white-space: nowrap;
      cursor: pointer;

      @include interactive.states(surface);
    }

    :host(.v2-filter-chip--selected) {
      background: var(--v2-ink);
      border-color: var(--v2-ink);
      color: var(--v2-on-ink);

      &:hover#{interactive.$enabled} {
        @include interactive.hover(ink);
      }

      &:active#{interactive.$enabled} {
        @include interactive.pressed(ink);
      }
    }

    .v2-filter-chip__dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: var(--v2-radius-pill);
    }

    :host(.v2-filter-chip--selected) .v2-filter-chip__dot {
      box-shadow: 0 0 0 2px var(--v2-on-ink);
    }

    .v2-filter-chip__count {
      font-size: 12px;
      font-weight: 400;
      opacity: 0.7;
    }
  `,
})
export class V2FilterChip {
  readonly selected = input(false);
  readonly tone = input<V2Tone | null>(null);
  readonly count = input<number | null>(null);

  protected readonly dotColor = computed(() => {
    const tone = this.tone();
    return tone === null ? null : v2ToneColor(tone);
  });
}
