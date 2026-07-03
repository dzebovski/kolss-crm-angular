import { Component, computed, input } from '@angular/core';
import { UiIcon, UiIconName } from '../icon/ui-icon';

export type UiAlertTone = 'info' | 'success' | 'warning' | 'danger';

const UI_ALERT_ICONS: Record<UiAlertTone, UiIconName> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  danger: 'error',
};

@Component({
  selector: 'app-ui-alert',
  imports: [UiIcon],
  template: `
    <div class="ui-alert" [class]="'ui-alert ui-alert--' + tone()" role="status">
      <app-ui-icon [name]="icon()" [size]="20" />
      <div>
        <strong>{{ title() }}</strong>
        <div class="ui-alert__body"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    .ui-alert {
      padding: var(--ui-space-4);
      border: 1px solid color-mix(in srgb, var(--ui-info) 18%, white);
      border-radius: var(--ui-radius-md);
      background: var(--ui-info-soft);
      color: var(--ui-info);
      display: flex;
      align-items: flex-start;
      gap: var(--ui-space-3);
    }

    .ui-alert--success {
      border-color: color-mix(in srgb, var(--ui-success) 18%, white);
      background: var(--ui-success-soft);
      color: var(--ui-success);
    }

    .ui-alert--warning {
      border-color: color-mix(in srgb, var(--ui-warning) 18%, white);
      background: var(--ui-warning-soft);
      color: var(--ui-warning);
    }

    .ui-alert--danger {
      border-color: color-mix(in srgb, var(--ui-danger) 18%, white);
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
    }

    strong {
      display: block;
      font-size: 0.875rem;
    }

    .ui-alert__body {
      margin-top: 0.15rem;
      color: var(--ui-text-muted);
      font-size: 0.8125rem;
    }
  `,
})
export class UiAlert {
  readonly tone = input<UiAlertTone>('info');
  readonly title = input('Information');
  protected readonly icon = computed<UiIconName>(() => UI_ALERT_ICONS[this.tone()]);
}
