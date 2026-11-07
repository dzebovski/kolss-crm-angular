import { Component, input } from '@angular/core';

// Inline notice of the project popups: `warn` (amber, e.g. less than 50% paid, balance unpaid,
// money already received) or `danger` (the save failed). The amber has no token: it is the
// "Client thinking" status colour mixed into the surface.
@Component({
  selector: 'app-v2-project-notice',
  host: { '[attr.data-tone]': 'tone()', '[attr.role]': "tone() === 'danger' ? 'alert' : 'note'" },
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      padding: 10px var(--v2-space-3);
      border-radius: var(--v2-radius-sm);
      font-size: 13px;
      line-height: 1.45;
    }

    :host([data-tone='warn']) {
      background: color-mix(in srgb, var(--v2-status-thinking) 10%, var(--v2-surface));
      color: var(--v2-ink);
    }

    :host([data-tone='danger']) {
      background: var(--v2-danger-bg);
      color: var(--v2-danger);
      font-weight: 500;
    }
  `,
})
export class V2ProjectNotice {
  readonly tone = input<'warn' | 'danger'>('warn');
}
