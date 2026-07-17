import { Component, input } from '@angular/core';

export type UiBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

@Component({
  selector: 'app-ui-badge',
  template: `<span class="ui-badge" [class]="'ui-badge ui-badge--' + tone()"><ng-content /></span>`,
  styles: `
    :host {
      display: inline-flex;
    }

    .ui-badge {
      min-height: 1.5rem;
      padding: 0 var(--ui-space-2);
      border: 1px solid transparent;
      border-radius: var(--ui-radius-pill);
      background: var(--ui-neutral-soft);
      color: var(--ui-neutral);
      display: inline-flex;
      align-items: center;
      font-size: 0.75rem;
      font-weight: 650;
      line-height: 1;
      white-space: nowrap;
    }

    .ui-badge--info {
      background: var(--ui-info-soft);
      color: var(--ui-info);
    }

    .ui-badge--success {
      background: var(--ui-success-soft);
      color: var(--ui-success);
    }

    .ui-badge--warning {
      background: var(--ui-warning-soft);
      color: var(--ui-warning);
    }

    .ui-badge--danger {
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
    }

    .ui-badge--brand {
      background: var(--ui-brand-soft);
      color: var(--ui-brand);
    }
  `,
})
export class UiBadge {
  readonly tone = input<UiBadgeTone>('neutral');
}
