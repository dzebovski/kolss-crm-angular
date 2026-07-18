import { Component, input, output } from '@angular/core';

import { UiIcon } from '../icon/ui-icon';
import type { UiBadgeTone } from './ui-badge';

@Component({
  selector: 'app-ui-chip',
  imports: [UiIcon],
  template: `
    <span class="ui-chip" [class]="'ui-chip ui-chip--' + tone()">
      <ng-content />
      @if (removable()) {
        <button type="button" [attr.aria-label]="'Remove ' + label()" (click)="removed.emit()">
          <app-ui-icon name="close" [size]="16" />
        </button>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
    }

    .ui-chip {
      min-height: 1.875rem;
      max-width: 100%;
      padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-pill);
      background: var(--ui-surface-raised);
      color: var(--ui-text-muted);
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-1);
      font-size: 0.8125rem;
      font-weight: 550;
      overflow: hidden;
    }

    .ui-chip--info {
      border-color: transparent;
      background: var(--ui-info-soft);
      color: var(--ui-info);
    }

    .ui-chip--success {
      border-color: transparent;
      background: var(--ui-success-soft);
      color: var(--ui-success);
    }

    .ui-chip--warning {
      border-color: transparent;
      background: var(--ui-warning-soft);
      color: var(--ui-warning);
    }

    .ui-chip--danger {
      border-color: transparent;
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
    }

    .ui-chip--brand {
      border-color: transparent;
      background: var(--ui-brand-soft);
      color: var(--ui-brand);
    }

    .ui-chip--neutral {
      /* default chip look */
    }

    button {
      flex: 0 0 auto;
      width: 1.25rem;
      height: 1.25rem;
      margin-right: -0.35rem;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
      display: grid;
      place-items: center;
    }

    button:hover {
      background: var(--ui-surface-muted);
      color: var(--ui-text);
    }
  `,
})
export class UiChip {
  readonly label = input('chip');
  readonly removable = input(false);
  readonly tone = input<UiBadgeTone>('neutral');
  readonly removed = output<void>();
}
