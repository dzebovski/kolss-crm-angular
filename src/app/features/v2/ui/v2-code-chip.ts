import { Component, input } from '@angular/core';

// Client code chip (design system components/StatusPill, `code` style on `surface-sunk`).
// `md` = lead card header (28px pill), `sm` = leads list row (Main.dc.html).
// TODO(v2): the design links the code to the client card, which doesn't exist yet; the chip is
// plain text until it does (then add the link and the lead card's arrow icon).
@Component({
  selector: 'app-v2-code-chip',
  template: `{{ code() }}`,
  host: { '[attr.data-size]': 'size()' },
  styles: `
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
  `,
})
export class V2CodeChip {
  readonly code = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');
}
