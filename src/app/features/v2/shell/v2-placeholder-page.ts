import { Component, input } from '@angular/core';

import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2EmptyState } from '../ui/v2-empty-state';

// Page for a v2 section that isn't designed yet: section eyebrow + title from the Leads
// title row (Main.dc.html) and the dashed empty state (`V2EmptyState`).
// `sectionKey` and `titleKey` come from the route `data`.
@Component({
  selector: 'app-v2-placeholder-page',
  imports: [TranslatePipe, V2EmptyState],
  template: `
    <header class="v2-placeholder__title-row">
      <p class="v2-placeholder__eyebrow">{{ sectionKey() | translate }}</p>
      <h1 class="v2-placeholder__title">{{ titleKey() | translate }}</h1>
    </header>
    <app-v2-empty-state
      [title]="'v2.placeholder.title' | translate"
      [hint]="'v2.placeholder.hint' | translate"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-4);
    }

    p,
    h1 {
      margin: 0;
    }

    .v2-placeholder__title-row {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-2);
    }

    .v2-placeholder__eyebrow {
      color: var(--v2-muted);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .v2-placeholder__title {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.1;
      letter-spacing: -0.01em;
    }
  `,
})
export class V2PlaceholderPage {
  readonly sectionKey = input.required<MessageKey>();
  readonly titleKey = input.required<MessageKey>();
}
