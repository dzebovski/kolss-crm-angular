import { Component, computed, input } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2_PROJECT_STATUS_COLOR, v2ProjectStatusLabelKey } from '@domain/v2/project-status';
import type { V2ProjectStatus } from '@domain/v2/project.types';

// Project status pill (Projects boards): dot + label in a bordered pill, the same anatomy as the
// lead `app-v2-status-pill` (28px, 8px dot); colours from `V2_PROJECT_STATUS_COLOR`.
@Component({
  selector: 'app-v2-project-status-pill',
  imports: [TranslatePipe],
  template: `
    <span class="v2-project-pill__dot" [style.background]="color()" aria-hidden="true"></span>
    {{ labelKey() | translate }}
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--v2-space-2);
      box-sizing: border-box;
      height: 28px;
      padding: 0 10px;
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-pill);
      color: var(--v2-ink);
      font-size: 13px;
      font-weight: 500;
      line-height: normal;
      white-space: nowrap;
    }

    .v2-project-pill__dot {
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: var(--v2-radius-pill);
    }
  `,
})
export class V2ProjectStatusPill {
  readonly status = input.required<V2ProjectStatus>();
  protected readonly color = computed(() => V2_PROJECT_STATUS_COLOR[this.status()]);
  protected readonly labelKey = computed(() => v2ProjectStatusLabelKey(this.status()));
}
