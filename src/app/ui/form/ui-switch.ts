import { Component, input, model, output } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';

@Component({
  selector: 'app-ui-switch',
  template: `
    <button
      type="button"
      class="ui-switch"
      role="switch"
      [attr.aria-checked]="checked()"
      [disabled]="disabled()"
      (click)="checked.update((value) => !value)"
      (blur)="touch.emit()"
    >
      <span class="ui-switch__track" aria-hidden="true"><span></span></span>
      <span>{{ label() }}</span>
    </button>
  `,
  styles: `
    .ui-switch {
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--ui-text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.875rem;
    }

    .ui-switch__track {
      width: 2.25rem;
      height: 1.25rem;
      padding: 0.125rem;
      border: 1px solid var(--ui-border-strong);
      border-radius: var(--ui-radius-pill);
      background: var(--ui-ink-180);
      transition: all var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-switch__track span {
      display: block;
      width: 0.875rem;
      height: 0.875rem;
      border-radius: 50%;
      background: white;
      box-shadow: var(--ui-shadow-1);
      transition: transform var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-switch[aria-checked='true'] .ui-switch__track {
      border-color: var(--ui-action);
      background: var(--ui-action);
    }

    .ui-switch[aria-checked='true'] .ui-switch__track span {
      transform: translateX(1rem);
    }

    .ui-switch:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class UiSwitch implements FormCheckboxControl {
  readonly checked = model(false);
  readonly label = input('Switch');
  readonly disabled = input(false);
  readonly touch = output<void>();
}
