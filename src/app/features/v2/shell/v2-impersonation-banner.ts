import { Component, input, output } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';

// Active-impersonation banner above the header, as in v1 (user, 2026-09-24). Not drawn in the
// design: a 40px `ink` strip with `on-ink` text, the only inverted surface of the shell, so the
// mode can't be missed.
@Component({
  selector: 'app-v2-impersonation-banner',
  imports: [TranslatePipe],
  host: { role: 'status' },
  template: `
    <span>{{ 'impersonation.banner' | translate: { name: name() } }}</span>
    <button type="button" (click)="stop.emit()">{{ 'v2.nav.returnToAdmin' | translate }}</button>
  `,
  styles: `
    @use '../../../../styles/v2/interactive';

    :host {
      display: flex;
      flex-shrink: 0;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 4px var(--v2-space-3);
      box-sizing: border-box;
      min-height: var(--v2-control-md);
      padding: var(--v2-space-2) var(--v2-space-5);
      background: var(--v2-ink);
      color: var(--v2-on-ink);
      font-size: 13px;
      font-weight: 500;
      line-height: 1.45;
      text-align: center;
    }

    button {
      padding: 0;
      background: transparent;
      border: 0;
      border-radius: var(--v2-radius-xs);
      color: inherit;
      font: inherit;
      font-weight: 600;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;

      @include interactive.transition;

      // On the ink strip: a thicker underline instead of the overlay.
      &:hover {
        text-decoration-thickness: 2px;
      }

      &:focus-visible {
        @include interactive.focus-ring($color: var(--v2-on-ink));
      }
    }
  `,
})
export class V2ImpersonationBanner {
  readonly name = input.required<string>();
  readonly stop = output<void>();
}
