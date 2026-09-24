import { Component, input } from '@angular/core';

// Empty state: dashed `line-strong` box with one bold line and one sentence of what happens
// next (design system README). `card` = lead card v1.3 (No status yet), fills the card;
// `list` = Leads board (No leads match these filters), centred. 12/10px radii and 18/32px
// paddings are board values without a token. Projected content (e.g. a retry button) goes
// below the hint.
@Component({
  selector: 'app-v2-empty-state',
  template: `
    <p class="v2-empty__title">{{ title() }}</p>
    <p class="v2-empty__hint">{{ hint() }}</p>
    <ng-content />
  `,
  host: { '[attr.data-layout]': 'layout()' },
  styles: `
    :host {
      display: flex;
      flex-grow: 1;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      padding: 18px;
      border: 1px dashed var(--v2-line-strong);
      border-radius: 12px;
    }

    :host([data-layout='list']) {
      flex-grow: 0;
      align-items: center;
      padding: var(--v2-space-6);
      border-radius: var(--v2-radius-md);
      text-align: center;
    }

    p {
      margin: 0;
    }

    .v2-empty__title {
      font-size: 15px;
      font-weight: 600;
    }

    .v2-empty__hint {
      color: var(--v2-muted);
      font-size: 13px;
      line-height: 1.45;
    }
  `,
})
export class V2EmptyState {
  readonly title = input.required<string>();
  readonly hint = input.required<string>();
  readonly layout = input<'card' | 'list'>('card');
}
