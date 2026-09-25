import { Component, computed, input, ViewEncapsulation } from '@angular/core';

// Popup field anatomy (Popup-rules.dc.html "No layout jumps" / "Validation"): 12px `muted`
// label over the control, 6px gap, then a reserved 18px message line that holds either the
// hint or the error — same height in both states, so the field never jumps. Required fields
// end with `*` (design system README). The label wraps the projected control, so no
// `for`/`id` pairing is needed; set `required`/`aria-invalid` on the control itself for
// assistive tech.
//
// Encapsulation is off because the control is projected content: emulated styles can't reach
// it. Every selector is scoped under `app-v2-form-field`, so nothing leaks outside the field.
@Component({
  selector: 'app-v2-form-field',
  encapsulation: ViewEncapsulation.None,
  template: `
    <!-- The projected control is inside the label (implicit association). -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label
      class="v2-field"
      [class.v2-field--invalid]="invalid()"
      [attr.data-v2-invalid]="invalid() ? '' : null"
    >
      @if (label()) {
        <span class="v2-field__label">
          {{ label() }}
          @if (required()) {
            <span aria-hidden="true">*</span>
          }
        </span>
      }
      <ng-content />
      @if (hint() || errorText()) {
        <span
          class="v2-field__message"
          [class.v2-field__message--err]="invalid()"
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

    // Board .msg: reserved 18px line, hint and error share the same slot.
    app-v2-form-field .v2-field__message {
      display: flex;
      min-height: 18px;
      align-items: flex-start;
      gap: 6px;
      margin-top: -2px;
      color: var(--v2-muted);
      font-size: 12px;
      line-height: 18px;
    }

    app-v2-form-field .v2-field__message svg {
      flex-shrink: 0;
      margin-top: 2px;
    }

    app-v2-form-field .v2-field__message--err {
      color: var(--v2-danger);
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

    // Board .fld-err: red border + tinted background, and the focus ring turns red too.
    app-v2-form-field
      .v2-field--invalid
      :where(input:not([type='checkbox'], [type='radio']), select, textarea) {
      border-color: var(--v2-danger);
      background-color: #fffafa;

      &:focus {
        border-color: var(--v2-danger);
        outline-color: var(--v2-danger);
      }
    }

    // Board .fld textarea: 10/12px padding, 1.45 line height, height from rows.
    app-v2-form-field textarea {
      height: auto;
      padding: 10px var(--v2-space-3);
      line-height: 1.45;
      resize: vertical;
    }

    // Select: the native arrow is replaced by a chevron, per Popup-rules.dc.html "Masks and
    // formats" — "native arrow hidden; one 16px chevron inside the field, 12px from the right
    // edge, text padding 12px left / 36px right — same everywhere in the system" (this
    // supersedes the 14px/14px/38px value G2 sourced from Main.dc.html's dropdown triggers).
    // The stroke is ink (#17171a); a data URI can't read the custom property.
    app-v2-form-field select {
      padding-right: 36px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2317171a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-position: right 12px center;
      background-repeat: no-repeat;
      background-size: 16px;
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
  /** Shown in the reserved message line while the field is valid. */
  readonly hint = input('');
  /** Non-empty switches the field to its error look and shows this text instead of the hint. */
  readonly error = input('');

  protected readonly invalid = computed(() => this.error() !== '');
  protected readonly errorText = computed(() => this.error());
}
