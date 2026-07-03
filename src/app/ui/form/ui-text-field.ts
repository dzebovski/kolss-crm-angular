import { Component, input, model, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

let nextTextFieldId = 0;

@Component({
  selector: 'app-ui-text-field',
  template: `
    <label class="ui-field__label" [for]="controlId">
      {{ label() }}
      @if (required()) {
        <span aria-hidden="true">*</span>
      }
    </label>
    <div class="ui-field__control" [class.ui-field__control--invalid]="invalid() || !!error()">
      <input
        [id]="controlId"
        [type]="type()"
        [name]="name()"
        [value]="value()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [readOnly]="readOnly()"
        [required]="required()"
        [attr.aria-invalid]="invalid() || !!error()"
        [attr.aria-describedby]="descriptionId"
        (input)="updateValue($event)"
        (blur)="touch.emit()"
      />
    </div>
    @if (error()) {
      <span class="ui-field__message ui-field__message--error" [id]="descriptionId" role="alert">
        {{ error() }}
      </span>
    } @else if (hint()) {
      <span class="ui-field__message" [id]="descriptionId">{{ hint() }}</span>
    }
  `,
  styleUrl: './ui-field.scss',
})
export class UiTextField implements FormValueControl<string> {
  readonly value = model('');
  readonly label = input('Label');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly type = input<'text' | 'email' | 'search' | 'password'>('text');
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly name = input('');
  readonly touch = output<void>();
  protected readonly controlId = `ui-text-field-${nextTextFieldId++}`;
  protected readonly descriptionId = `${this.controlId}-description`;

  protected updateValue(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
