import { Component, input, model, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

@Component({
  selector: 'app-ui-radio',
  template: `
    <label class="ui-radio" [class.ui-radio--disabled]="disabled()">
      <input
        type="radio"
        [name]="name()"
        [value]="optionValue()"
        [checked]="value() === optionValue()"
        [disabled]="disabled()"
        (change)="value.set(optionValue())"
        (blur)="touch.emit()"
      />
      <span class="ui-radio__dot" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </label>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .ui-radio {
      position: relative;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.875rem;
    }

    input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }

    .ui-radio__dot {
      width: 1.125rem;
      height: 1.125rem;
      border: 1.5px solid var(--ui-border-strong);
      border-radius: 50%;
      display: grid;
      place-items: center;
    }

    input:checked + .ui-radio__dot {
      border-color: var(--ui-action);
    }

    input:checked + .ui-radio__dot::after {
      content: '';
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 50%;
      background: var(--ui-action);
    }

    input:focus-visible + .ui-radio__dot {
      outline: 2px solid var(--ui-focus);
      outline-offset: 2px;
    }

    .ui-radio--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class UiRadio implements FormValueControl<string> {
  readonly value = model('');
  readonly optionValue = input.required<string>();
  readonly label = input('Radio option');
  readonly name = input('ui-radio-group');
  readonly disabled = input(false);
  readonly touch = output<void>();
}
