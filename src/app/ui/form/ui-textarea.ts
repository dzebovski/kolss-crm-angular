import { Component, input, model, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';

let nextTextareaId = 0;

@Component({
  selector: 'app-ui-textarea',
  template: `
    <label class="ui-field__label" [for]="controlId">
      {{ label() }}
      @if (required()) {
        <span aria-hidden="true">*</span>
      }
    </label>
    <div class="ui-field__control" [class.ui-field__control--invalid]="invalid() || !!error()">
      <textarea
        [id]="controlId"
        [name]="name()"
        [value]="value()"
        [placeholder]="placeholder()"
        [rows]="rows()"
        [disabled]="disabled()"
        [readOnly]="readOnly()"
        [required]="required()"
        [attr.aria-invalid]="invalid() || !!error()"
        [attr.aria-describedby]="error() || hint() ? descriptionId : null"
        (input)="updateValue($event)"
        (blur)="touch.emit()"
      ></textarea>
    </div>
    <span
      class="ui-field__message"
      [class.ui-field__message--error]="!!error()"
      [id]="descriptionId"
      [attr.role]="error() ? 'alert' : null"
      [attr.aria-hidden]="error() || hint() ? null : 'true'"
    >
      {{ error() || hint() }}
    </span>
  `,
  styleUrl: './ui-field.scss',
})
export class UiTextarea implements FormValueControl<string> {
  readonly value = model('');
  readonly label = input('Label');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly error = input('');
  readonly rows = input(4);
  readonly disabled = input(false);
  readonly readOnly = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly name = input('');
  readonly touch = output<void>();
  protected readonly controlId = `ui-textarea-${nextTextareaId++}`;
  protected readonly descriptionId = `${this.controlId}-description`;

  protected updateValue(event: Event) {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }
}
