import { Component, input, model, output } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';

@Component({
  selector: 'app-ui-checkbox',
  template: `
    <label class="ui-check" [class.ui-check--disabled]="disabled()">
      <input
        type="checkbox"
        [checked]="checked()"
        [disabled]="disabled()"
        [required]="required()"
        [attr.aria-invalid]="invalid()"
        (change)="updateChecked($event)"
        (blur)="touch.emit()"
      />
      <span class="ui-check__box" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </label>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .ui-check {
      position: relative;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      color: var(--ui-text);
      font-size: 0.875rem;
    }

    input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }

    .ui-check__box {
      width: 1.125rem;
      height: 1.125rem;
      border: 1.5px solid var(--ui-border-strong);
      border-radius: 0.3rem;
      background: white;
      display: grid;
      place-items: center;
      transition: all var(--ui-duration-fast) var(--ui-ease);
    }

    input:checked + .ui-check__box {
      border-color: var(--ui-action);
      background: var(--ui-action);
    }

    input:checked + .ui-check__box::after {
      content: '';
      width: 0.45rem;
      height: 0.25rem;
      border: solid white;
      border-width: 0 0 2px 2px;
      transform: translateY(-1px) rotate(-45deg);
    }

    input:focus-visible + .ui-check__box {
      outline: 2px solid var(--ui-focus);
      outline-offset: 2px;
    }

    .ui-check--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class UiCheckbox implements FormCheckboxControl {
  readonly checked = model(false);
  readonly label = input('Checkbox');
  readonly disabled = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();

  protected updateChecked(event: Event) {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
