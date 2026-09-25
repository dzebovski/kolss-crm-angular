import { Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

export interface V2CardSelectOption {
  readonly id: string;
  readonly label: string;
  readonly sub?: string;
}

// Card-select (Create-lead.dc.html `cardStyle()` + `showroomOpts`): a 2-column grid of cards
// with a label and an optional sub-line, single-select, `ink` border + inset ring when picked.
// Used for the showroom picker; presentational and generic (`options` is plain data), so it
// isn't tied to showrooms specifically. The off-state border reads `--v2-field-tone`, so
// wrapping it in `app-v2-field-group` turns every card red at once when Save is pressed with
// nothing picked (Popup-rules.dc.html "No layout jumps").
@Component({
  selector: 'app-v2-card-select',
  template: `
    <div class="v2-card-select">
      @for (option of options(); track option.id) {
        <button
          type="button"
          class="v2-card-select__card"
          [class.v2-card-select__card--on]="value() === option.id"
          [attr.aria-pressed]="value() === option.id"
          (click)="pick(option.id)"
        >
          <span class="v2-card-select__label">{{ option.label }}</span>
          @if (option.sub) {
            <span class="v2-card-select__sub">{{ option.sub }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    @use '../../../../styles/v2/interactive';

    .v2-card-select {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--v2-space-2);
    }

    .v2-card-select__card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;
      gap: 2px;
      min-height: 56px;
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px;
      background: var(--v2-surface);
      border: 1px solid var(--v2-field-tone, var(--v2-line-strong));
      border-radius: var(--v2-radius-md);
      color: var(--v2-ink);
      font-family: inherit;
      text-align: left;
      cursor: pointer;

      @include interactive.states(surface);
    }

    .v2-card-select__card--on {
      border-color: var(--v2-ink);
      box-shadow: inset 0 0 0 1px var(--v2-ink);
    }

    .v2-card-select__label {
      font-size: 14px;
      font-weight: 500;
    }

    .v2-card-select__sub {
      color: var(--v2-muted);
      font-size: 12px;
    }

    @media (max-width: 480px) {
      .v2-card-select {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class V2CardSelect implements FormValueControl<string> {
  readonly value = model('');
  readonly options = input.required<readonly V2CardSelectOption[]>();
  readonly touch = output<void>();

  protected pick(id: string): void {
    this.value.set(id);
    this.touch.emit();
  }
}
