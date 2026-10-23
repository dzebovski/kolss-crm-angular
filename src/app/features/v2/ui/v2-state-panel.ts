import { Component, input } from '@angular/core';

export type V2StatePanelTone = 'error' | 'empty' | 'neutral';
export type V2StatePanelIcon = 'alert' | 'people' | 'search';

// State panel of the Clients boards (Clients-list-error / -empty, Client-card-error / -not-found):
// a 44px icon circle, a 16px title, a hint of at most 460px and the actions below. `error` is the
// red-tinted alert panel, `empty` the dashed "nothing here yet" panel, `neutral` the plain
// "not found" panel. 48/32px padding, the 44px circle and 460px hint are board values without
// a token. Projected content (buttons) goes below the hint.
@Component({
  selector: 'app-v2-state-panel',
  template: `
    <span class="v2-state__icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24">
        @switch (icon()) {
          @case ('alert') {
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5" />
            <path d="M12 16.5h.01" />
          }
          @case ('people') {
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          }
          @case ('search') {
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          }
        }
      </svg>
    </span>
    <p class="v2-state__title">{{ title() }}</p>
    <p class="v2-state__hint">{{ hint() }}</p>
    <div class="v2-state__actions"><ng-content /></div>
  `,
  host: {
    '[attr.data-tone]': 'tone()',
    '[attr.role]': "tone() === 'error' ? 'alert' : 'status'",
  },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--v2-space-2);
      padding: 48px var(--v2-space-6);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line);
      border-radius: var(--v2-radius-lg);
      text-align: center;
    }

    :host([data-tone='empty']) {
      border: 1px dashed var(--v2-line-strong);
    }

    :host([data-tone='error']) {
      background: #fffafa;
      border-color: #f1c5c0;
    }

    p {
      margin: 0;
    }

    .v2-state__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: var(--v2-surface-sunk);
      border-radius: var(--v2-radius-pill);
      color: var(--v2-ink-2);

      svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }

    :host([data-tone='error']) .v2-state__icon {
      background: var(--v2-danger-bg);
      color: var(--v2-danger);

      svg {
        stroke-width: 2;
      }
    }

    .v2-state__title {
      font-size: 16px;
      font-weight: 600;
    }

    .v2-state__hint {
      max-width: 460px;
      color: var(--v2-muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .v2-state__actions {
      display: flex;
      gap: var(--v2-space-2);
      margin-top: 10px;

      &:empty {
        display: none;
      }
    }
  `,
})
export class V2StatePanel {
  readonly tone = input<V2StatePanelTone>('neutral');
  readonly icon = input<V2StatePanelIcon>('search');
  readonly title = input.required<string>();
  readonly hint = input.required<string>();
}
