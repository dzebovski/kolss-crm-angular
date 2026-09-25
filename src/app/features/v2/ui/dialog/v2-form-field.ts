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
      @if (label()) {
        <span class="v2-field__label">
          {{ label() }}
          @if (required()) {
            <span aria-hidden="true">*</span>
          }
        </span>
      }
      <ng-content />
    </label>
  `,
  styles: `
    @use '../../../../../styles/v2/interactive';

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

    // Board .fld class. :where() keeps its specificity at the element level, so the
    // textarea and select rules below override it.
    app-v2-form-field :where(input:not([type='checkbox'], [type='radio']), select, textarea) {
      width: 100%;
      height: var(--v2-control-md);
      box-sizing: border-box;
      padding: 0 var(--v2-space-3);
      background-color: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-ink);
      font: inherit;
      font-size: 14px;

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

    // Board .fld textarea: 10/12px padding, 1.45 line height, height from rows.
    app-v2-form-field textarea {
      height: auto;
      padding: 10px var(--v2-space-3);
      line-height: 1.45;
      resize: vertical;
    }

    // Select: the native arrow is replaced by the 14px chevron of the board's dropdown
    // triggers (Main.dc.html, Set call result: m6 9 6 6 6-6, stroke 2), 14px from the right
    // edge. The stroke is ink (#17171a); a data URI can't read the custom property.
    app-v2-form-field select {
      padding-right: 38px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2317171a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-position: right 14px center;
      background-repeat: no-repeat;
      background-size: 14px;
      appearance: none;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    app-v2-form-field select:disabled {
      cursor: not-allowed;
    }
  `,
})
export class V2FormField {
  /** Empty = no visible label (the control then needs its own `aria-label`). */
  readonly label = input('');
  readonly required = input(false);
}
