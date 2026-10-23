import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';

// Client code chip (design system components/StatusPill, `code` style on `surface-sunk`).
// `md` = lead card header (28px pill), `sm` = leads list row (Main.dc.html). With a `clientId`
// the code links to the client card (the lead card's chip also draws the arrow); without one
// it stays plain text (task rows, popups, leads that have no client yet).
@Component({
  selector: 'app-v2-code-chip',
  imports: [RouterLink, TranslatePipe],
  template: `
    @if (clientId(); as id) {
      <a
        class="v2-code-chip__link"
        [routerLink]="['/v2/clients', id]"
        [attr.aria-label]="'v2.client.openCard' | translate: { code: code() }"
      >
        {{ code() }}
        @if (size() === 'md') {
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
          </svg>
        }
      </a>
    } @else {
      {{ code() }}
    }
  `,
  host: { '[attr.data-size]': 'size()' },
  styles: `
    @use '../../../../styles/v2/interactive';

    :host {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      box-sizing: border-box;
      height: 28px;
      padding: 0 10px;
      background: var(--v2-surface-sunk);
      border-radius: var(--v2-radius-pill);
      color: var(--v2-ink);
      font-family: var(--v2-font-mono);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
      white-space: nowrap;
    }

    :host([data-size='sm']) {
      height: auto;
      padding: 1px 6px;
      border-radius: var(--v2-radius-xs);
    }

    .v2-code-chip__link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: inherit;
      text-decoration: none;

      svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      &:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      &:focus-visible {
        border-radius: 2px;
        @include interactive.focus-ring;
      }
    }
  `,
})
export class V2CodeChip {
  readonly code = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');
  /** The lead's client; makes the code a link to the client card. */
  readonly clientId = input<string | null>(null);
}
