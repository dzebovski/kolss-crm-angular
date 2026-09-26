import { Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

export interface V2SelectOption {
  readonly value: string;
  readonly label: string;
}

// Generic native `<select>` control (Popup-rules.dc.html "Masks and formats": "Dropdowns
// (manager, currency): native arrow hidden; one 16px chevron inside the field, 12px from the
// right edge, text padding 12px left / 36px right — same everywhere in the system."). A
// `FormValueControl<string>` so it drops into `[formField]` like a native input; used stand-alone
// (e.g. the currency picker beside `app-v2-budget-input`, which sits outside `app-v2-form-field`)
// as well as inside one.
@Component({
  selector: 'app-v2-select',
  template: `
    <span class="v2-select">
      <select
        class="v2-select__control"
        [attr.aria-label]="ariaLabel() || null"
        [value]="value()"
        (change)="onChange($event)"
        (blur)="touch.emit()"
      >
        @for (option of options(); track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>
      <svg
        class="v2-select__chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  `,
  styles: `
    @use '../../../../styles/v2/interactive';

    .v2-select {
      position: relative;
      display: block;
    }

    .v2-select__control {
      width: 100%;
      height: var(--v2-control-md);
      box-sizing: border-box;
      padding: 0 36px 0 var(--v2-space-3);
      appearance: none;
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-ink);
      font: inherit;
      font-size: 14px;
      cursor: pointer;
      text-overflow: ellipsis;

      @include interactive.transition;

      &:hover:not(:disabled) {
        border-color: var(--v2-line-hover);
      }

      &:disabled {
        @include interactive.disabled;
      }

      &:focus {
        border-color: var(--v2-ink);
        outline: 2px solid var(--v2-ink);
        outline-offset: -1px;
      }
    }

    .v2-select__chevron {
      position: absolute;
      top: 50%;
      right: 12px;
      color: var(--v2-muted);
      pointer-events: none;
      transform: translateY(-50%);
    }
  `,
})
export class V2Select implements FormValueControl<string> {
  readonly value = model('');
  readonly options = input.required<readonly V2SelectOption[]>();
  readonly ariaLabel = input('');
  readonly touch = output<void>();

  protected onChange(event: Event): void {
    this.value.set((event.target as HTMLSelectElement).value);
  }
}
