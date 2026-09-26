import { Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import { v2FormatPhoneInput, type V2PhoneCountryCode } from '@domain/v2/phone-mask';

// Phone mask (Popup-rules.dc.html "Masks and formats"): one field, no separate country-code
// picker — the code is typed or added from the office (`v2FormatPhoneInput`). `touch` fires on
// blur so a `validate()` phone rule (`v2ValidatePhone`) only shows in the G2 message line once
// the person leaves the field, per "Format checks … run when the field loses focus."
@Component({
  selector: 'app-v2-phone-input',
  template: `
    <input
      class="v2-phone-input"
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="onInput($event)"
      (blur)="touch.emit()"
    />
  `,
  styles: `
    @use '../../../../styles/v2/interactive';

    .v2-phone-input {
      width: 100%;
      height: var(--v2-control-md);
      box-sizing: border-box;
      padding: 0 var(--v2-space-3);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-ink);
      font: inherit;
      font-size: 14px;

      @include interactive.transition;

      &:hover:not(:disabled) {
        border-color: var(--v2-line-hover);
      }

      &:focus {
        border-color: var(--v2-ink);
        outline: 2px solid var(--v2-ink);
        outline-offset: -1px;
      }
    }
  `,
})
export class V2PhoneInput implements FormValueControl<string> {
  readonly value = model('');
  /** Office the popup is for (`OFFICE_CONFIG[id].phoneCountryCode`); added to a bare number. */
  readonly countryCode = input.required<V2PhoneCountryCode>();
  /** `OFFICE_CONFIG[id].phonePlaceholder` — a real sample number, e.g. `+48 601 334 812`. */
  readonly placeholder = input('');
  readonly touch = output<void>();

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.value.set(v2FormatPhoneInput(raw, this.countryCode()));
  }
}
