import { Component, input, ViewEncapsulation } from '@angular/core';

// Popup field from lead card v1.3: 12px `muted` label over the control, 6px gap; required
// fields end with `*` (design system README). The label wraps the projected control, so no
// `for`/`id` pairing is needed; set `required` on the control itself for assistive tech.
//
// Encapsulation is off because the control is projected content: emulated styles can't reach
// it. Every selector is scoped under `app-v2-form-field`, so nothing leaks outside the field.
@Component({
  selector: 'app-v2-form-field',
  encapsulation: ViewEncapsulation.None,
  template: `
    <!-- The projected control is inside the label (implicit association). -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label class="v2-field">
      <span class="v2-field__label">
        {{ label() }}
        @if (required()) {
          <span aria-hidden="true">*</span>
        }
      </span>
      <ng-content />
    </label>
  `,
  styles: `
    app-v2-form-field {
      display: block;
    }

    app-v2-form-field .v2-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    app-v2-form-field .v2-field__label {
      color: var(--v2-muted);
      font-size: 12px;
    }

    // Board .fld class.
    app-v2-form-field :is(input:not([type='checkbox'], [type='radio']), select, textarea) {
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

      &:focus {
        border-color: var(--v2-ink);
        outline: 2px solid var(--v2-ink);
        outline-offset: -1px;
      }
    }

    app-v2-form-field textarea {
      height: auto;
      padding: 10px var(--v2-space-3);
      line-height: 1.45;
      resize: vertical;
    }
  `,
})
export class V2FormField {
  readonly label = input.required<string>();
  readonly required = input(false);
}
