import { Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

export interface V2ChipOption {
  readonly id: string;
  readonly label: string;
}

// Single-select chip row (Create-lead.dc.html `chipStyle()` + `sourceChips`: "Lead source" is
// one pick, `f.source === x`). Generic and presentational — used for source, or any other
// exclusive-choice chip row. See `V2ChipGroup` for the multi-select variant (product/reason
// chips).
@Component({
  selector: 'app-v2-chip-select',
  template: `
    <div class="v2-chip-select" role="radiogroup" [attr.aria-label]="ariaLabel() || null">
      @for (option of options(); track option.id) {
        <button
          type="button"
          class="v2-chip-select__chip"
          [class.v2-chip-select__chip--on]="value() === option.id"
          role="radio"
          [attr.aria-checked]="value() === option.id"
          (click)="pick(option.id)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    @use '../../../../styles/v2/chip';

    .v2-chip-select {
      display: flex;
      flex-wrap: wrap;
      gap: var(--v2-space-2);
    }

    .v2-chip-select__chip {
      @include chip.base;
    }

    .v2-chip-select__chip--on {
      @include chip.on;
    }
  `,
})
export class V2ChipSelect implements FormValueControl<string> {
  readonly value = model('');
  readonly options = input.required<readonly V2ChipOption[]>();
  readonly ariaLabel = input('');
  readonly touch = output<void>();

  protected pick(id: string): void {
    this.value.set(id);
    this.touch.emit();
  }
}
