import { Component, input, output } from '@angular/core';
import { UiIcon, UiIconName } from '../icon/ui-icon';
import { UiButtonVariant } from './ui-button';

@Component({
  selector: 'app-ui-icon-button',
  imports: [UiIcon],
  template: `
    <button
      type="button"
      class="ui-icon-button"
      [class.ui-icon-button--primary]="variant() === 'primary'"
      [class.ui-icon-button--danger]="variant() === 'danger'"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="pressed.emit()"
    >
      <app-ui-icon [name]="icon()" [size]="size() === 'small' ? 18 : 20" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .ui-icon-button {
      width: var(--ui-control-height);
      height: var(--ui-control-height);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      color: var(--ui-text-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: all var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-icon-button:hover:not(:disabled) {
      border-color: var(--ui-border-strong);
      background: var(--ui-surface-muted);
      color: var(--ui-text);
    }

    .ui-icon-button--primary {
      border-color: transparent;
      background: var(--ui-action);
      color: white;
    }

    .ui-icon-button--danger {
      border-color: transparent;
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
    }

    .ui-icon-button:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }
  `,
})
export class UiIconButton {
  readonly icon = input.required<UiIconName>();
  readonly label = input.required<string>();
  readonly variant = input<UiButtonVariant>('secondary');
  readonly size = input<'small' | 'medium'>('medium');
  readonly disabled = input(false);
  readonly pressed = output<void>();
}
