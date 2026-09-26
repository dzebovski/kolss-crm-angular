import { Component, computed, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import type { ContractCurrency } from '@domain/lead.types';
import {
  v2BudgetPresets,
  V2_BUDGET_CURRENCY_SYMBOL,
  v2FormatBudgetInput,
} from '@domain/v2/budget-mask';
import { V2Select, type V2SelectOption } from './v2-select';

const CURRENCIES: readonly ContractCurrency[] = ['PLN', 'USD', 'EUR', 'UAH'];

// Budget amount/range + currency + quick-range chips (Popup-rules.dc.html "Masks and formats":
// "one input for an amount or a range … Currency is a separate dropdown, default from the
// showroom … Quick ranges fill the input."). `value` is the amount/range text only — the
// currency is a separate two-way `currency` model, matching how the existing popups keep
// budget text and currency as two fields (see `V2StatusDialog`); a preset chip writes straight
// into `value`, exactly like typing it.
@Component({
  selector: 'app-v2-budget-input',
  imports: [V2Select],
  template: `
    <div class="v2-budget-input__row">
      <input
        class="v2-budget-input__field"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="onAmountInput($event)"
        (blur)="touch.emit()"
      />
      <div class="v2-budget-input__currency">
        <app-v2-select
          [ariaLabel]="currencyLabel()"
          [options]="currencyOptions()"
          [value]="currency()"
          (valueChange)="onCurrencyChange($event)"
        />
      </div>
    </div>
    @if (presets().length) {
      <div class="v2-budget-input__presets">
        @for (preset of presets(); track preset.text) {
          <button
            type="button"
            class="v2-budget-input__preset"
            [class.v2-budget-input__preset--on]="value() === preset.text"
            [attr.aria-pressed]="value() === preset.text"
            (click)="pickPreset(preset.text)"
          >
            {{ preset.text }}
          </button>
        }
      </div>
    }
  `,
  styles: `
    @use '../../../../styles/v2/chip';

    .v2-budget-input__row {
      display: flex;
      gap: var(--v2-space-2);
    }

    .v2-budget-input__field {
      flex: 1 1 auto;
      min-width: 0;
      height: var(--v2-control-md);
      box-sizing: border-box;
      padding: 0 var(--v2-space-3);
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-ink);
      font: inherit;
      font-size: 14px;

      &:hover:not(:disabled) {
        border-color: var(--v2-line-hover);
      }

      &:focus {
        border-color: var(--v2-ink);
        outline: 2px solid var(--v2-ink);
        outline-offset: -1px;
      }
    }

    .v2-budget-input__currency {
      flex-shrink: 0;
      width: 88px;
    }

    .v2-budget-input__presets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--v2-space-2);
      margin-top: var(--v2-space-2);
    }

    .v2-budget-input__preset {
      @include chip.base;

      height: 28px;
      padding: 0 10px;
      font-size: 12px;
    }

    .v2-budget-input__preset--on {
      @include chip.on;
    }
  `,
})
export class V2BudgetInput implements FormValueControl<string> {
  readonly value = model('');
  /** Two-way: the currency dropdown next to the amount field. */
  readonly currency = model<ContractCurrency>('PLN');
  readonly placeholder = input('');
  readonly currencyLabel = input('Currency');
  readonly touch = output<void>();

  protected readonly currencyOptions = computed<readonly V2SelectOption[]>(() =>
    CURRENCIES.map((code) => ({ value: code, label: V2_BUDGET_CURRENCY_SYMBOL[code] })),
  );
  protected readonly presets = computed(() => v2BudgetPresets(this.currency()));

  protected onAmountInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.value.set(v2FormatBudgetInput(raw, this.value()));
  }

  protected pickPreset(text: string): void {
    this.value.set(text);
  }

  /** `V2Select` is a generic `FormValueControl<string>`; narrow back to the known currencies. */
  protected onCurrencyChange(next: string): void {
    if (CURRENCIES.includes(next as ContractCurrency)) this.currency.set(next as ContractCurrency);
  }
}
