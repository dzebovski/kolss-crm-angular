import { Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

import type { V2ChipOption } from './v2-chip-select';

// Multi-select chip row (Create-lead.dc.html `chipStyle()` + `toggleIn`: product chips
// "Product · one or more", and the Lost popup's reason chips — `REASONS` is toggled through
// `toggleIn`, i.e. multiple reasons, not one (see the note in the G3 report: the existing
// `V2StatusDialog` built in G2 treats "Lost" reasons as single-select; C7–C13, which wires
// these controls into the real popups, should switch it to this control). Generic and
// presentational, like `V2ChipSelect`.
@Component({
  selector: 'app-v2-chip-group',
  template: `
    <div class="v2-chip-group" role="group" [attr.aria-label]="ariaLabel() || null">
      @for (option of options(); track option.id) {
        <button
          type="button"
          class="v2-chip-group__chip"
          [class.v2-chip-group__chip--on]="isOn(option.id)"
          [attr.aria-pressed]="isOn(option.id)"
          (click)="toggle(option.id)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    @use '../../../../styles/v2/chip';

    .v2-chip-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--v2-space-2);
    }

    .v2-chip-group__chip {
      @include chip.base;
    }

    .v2-chip-group__chip--on {
      @include chip.on;
    }
  `,
})
export class V2ChipGroup implements FormValueControl<readonly string[]> {
  readonly value = model<readonly string[]>([]);
  readonly options = input.required<readonly V2ChipOption[]>();
  readonly ariaLabel = input('');
  readonly touch = output<void>();

  protected isOn(id: string): boolean {
    return this.value().includes(id);
  }

  protected toggle(id: string): void {
    const current = this.value();
    this.value.set(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    this.touch.emit();
  }
}
