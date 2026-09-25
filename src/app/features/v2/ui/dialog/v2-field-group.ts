import { Component, computed, input, ViewEncapsulation } from '@angular/core';

// Popup-rules.dc.html "No layout jumps": "Groups (showroom, reasons, checklist) and dropdowns
// use the same reserved [message] line and only change their border colour." This is the
// group counterpart of `V2FormField` for content that isn't a single native control (chip
// rows, checklists, card-selects): same label + reserved 18px message line, `role="group"`
// instead of `<label>`. Content is free-form; a chip/checklist wants the invalid tone, it
// reads it from the `--v2-field-tone` custom property this host sets
// (`border-color: var(--v2-field-tone, var(--v2-line-strong))`), switching only its border
// colour, per the rule.
@Component({
  selector: 'app-v2-field-group',
  encapsulation: ViewEncapsulation.None,
  host: {
    role: 'group',
    '[attr.aria-label]': 'label() || null',
    '[style.--v2-field-tone]': 'invalid() ? "var(--v2-danger)" : null',
  },
  template: `
    <div class="v2-field-group" [attr.data-v2-invalid]="invalid() ? '' : null">
      @if (label()) {
        <span class="v2-field-group__label">
          {{ label() }}
          @if (required()) {
            <span aria-hidden="true">*</span>
          }
        </span>
      }
      <ng-content />
      @if (hint() || errorText()) {
        <span
          class="v2-field-group__message"
          [class.v2-field-group__message--err]="invalid()"
          aria-live="polite"
        >
          @if (invalid()) {
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5" />
              <path d="M12 16.5h.01" />
            </svg>
          }
          <span>{{ invalid() ? errorText() : hint() }}</span>
        </span>
      }
    </div>
  `,
  styles: `
    app-v2-field-group {
      display: block;
    }

    app-v2-field-group .v2-field-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    app-v2-field-group .v2-field-group__label {
      color: var(--v2-muted);
      font-size: 12px;
    }

    app-v2-field-group .v2-field-group__message {
      display: flex;
      min-height: 18px;
      align-items: flex-start;
      gap: 6px;
      margin-top: -2px;
      color: var(--v2-muted);
      font-size: 12px;
      line-height: 18px;
    }

    app-v2-field-group .v2-field-group__message svg {
      flex-shrink: 0;
      margin-top: 2px;
    }

    app-v2-field-group .v2-field-group__message--err {
      color: var(--v2-danger);
    }
  `,
})
export class V2FieldGroup {
  readonly label = input('');
  readonly required = input(false);
  readonly hint = input('');
  readonly error = input('');

  protected readonly invalid = computed(() => this.error() !== '');
  protected readonly errorText = computed(() => this.error());
}
