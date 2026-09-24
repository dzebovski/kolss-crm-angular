import { Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2LeadDisplayStatus } from '@domain/v2/lead-view.types';
import { V2_STATUS_LABEL, v2ToneColor } from './v2-tone';

// StatusPill (design system components/StatusPill): dot + label in a bordered pill; Project
// is the only filled one. `md` = lead card header, `sm` = leads list row (Main.dc.html).
@Component({
  selector: 'app-v2-status-pill',
  imports: [TranslatePipe],
  template: `
    <span class="v2-status-pill__dot" [style.background]="dotColor()" aria-hidden="true"></span>
    {{ labelKey() | translate }}
  `,
  host: {
    '[attr.data-size]': 'size()',
    '[class.v2-status-pill--project]': "status() === 'project'",
  },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-sizing: border-box;
      height: 28px;
      padding: 0 var(--v2-space-3);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-pill);
      color: var(--v2-ink);
      font-size: 13px;
      font-weight: 500;
      line-height: normal;
      white-space: nowrap;
    }

    :host([data-size='sm']) {
      gap: var(--v2-space-2);
      padding: 0 10px;
    }

    :host(.v2-status-pill--project) {
      background: var(--v2-ink);
      border-color: var(--v2-ink);
      color: var(--v2-on-ink);
    }

    .v2-status-pill__dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: var(--v2-radius-pill);
    }
  `,
})
export class V2StatusPill {
  readonly status = input.required<V2LeadDisplayStatus>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly labelKey = computed(() => V2_STATUS_LABEL[this.status()]);
  protected readonly dotColor = computed(() =>
    this.status() === 'project' ? 'var(--v2-on-ink)' : v2ToneColor(this.status()),
  );
}
