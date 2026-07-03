import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, input, model, output, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { UiIcon } from '../icon/ui-icon';

export interface UiSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

let nextSelectId = 0;

@Component({
  selector: 'app-ui-select',
  imports: [Combobox, ComboboxPopup, ComboboxWidget, Listbox, Option, UiIcon],
  template: `
    <label class="ui-select__label" [id]="labelId" [for]="controlId">
      {{ label() }}
      @if (required()) {
        <span aria-hidden="true">*</span>
      }
    </label>
    <div class="ui-select__root">
      <button
        type="button"
        [id]="controlId"
        ngCombobox
        #combobox="ngCombobox"
        class="ui-select__trigger"
        [class.ui-select__trigger--invalid]="invalid() || !!error()"
        [(expanded)]="expanded"
        [disabled]="disabled()"
        [attr.aria-labelledby]="labelId"
        [attr.aria-invalid]="invalid() || !!error()"
        [attr.aria-describedby]="descriptionId"
        (blur)="touch.emit()"
      >
        <span [class.ui-select__placeholder]="!selectedLabel()">
          {{ selectedLabel() || placeholder() }}
        </span>
        <app-ui-icon name="keyboard_arrow_down" [size]="20" />
      </button>

      <ng-template ngComboboxPopup [combobox]="combobox">
        <ul
          ngComboboxWidget
          ngListbox
          #listbox="ngListbox"
          class="ui-select__options"
          focusMode="activedescendant"
          selectionMode="explicit"
          [value]="selectedValues()"
          [activeDescendant]="listbox.activeDescendant()"
          (valueChange)="selectValue($event)"
        >
          @for (option of options(); track option.value) {
            <li
              ngOption
              class="ui-select__option"
              [value]="option.value"
              [label]="option.label"
              [disabled]="option.disabled ?? false"
            >
              {{ option.label }}
              @if (option.value === value()) {
                <app-ui-icon name="check" [size]="18" />
              }
            </li>
          }
        </ul>
      </ng-template>
    </div>
    @if (error()) {
      <span class="ui-select__message ui-select__message--error" [id]="descriptionId" role="alert">
        {{ error() }}
      </span>
    } @else if (hint()) {
      <span class="ui-select__message" [id]="descriptionId">{{ hint() }}</span>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--ui-space-2);
      min-width: 0;
    }

    .ui-select__label {
      font-size: 0.8125rem;
      font-weight: 650;
    }

    .ui-select__label span,
    .ui-select__message--error {
      color: var(--ui-danger);
    }

    .ui-select__root {
      position: relative;
    }

    .ui-select__trigger {
      width: 100%;
      min-height: var(--ui-control-height);
      padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-border-strong);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      color: var(--ui-text);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-2);
      text-align: left;
    }

    .ui-select__trigger[aria-expanded='true'] {
      border-color: var(--ui-focus);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-focus) 16%, transparent);
    }

    .ui-select__trigger--invalid {
      border-color: var(--ui-danger);
    }

    .ui-select__trigger:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .ui-select__placeholder,
    .ui-select__message {
      color: var(--ui-text-subtle);
    }

    .ui-select__message {
      font-size: 0.75rem;
    }

    .ui-select__options {
      position: absolute;
      z-index: var(--ui-z-overlay);
      inset: calc(100% + var(--ui-space-2)) 0 auto;
      max-height: 15rem;
      margin: 0;
      padding: var(--ui-space-2);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-2);
      list-style: none;
      overflow-y: auto;
    }

    .ui-select__option {
      min-height: 2.25rem;
      padding: 0 var(--ui-space-3);
      border-radius: var(--ui-radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.875rem;
      transition: background-color var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-select__option[data-active='true']:not([aria-selected='true']),
    .ui-select__option:hover:not([aria-selected='true']) {
      background: var(--ui-surface-subtle);
    }

    .ui-select__option[aria-selected='true'] {
      background: var(--ui-surface-muted);
    }

    .ui-select__option[aria-disabled='true'] {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `,
})
export class UiSelect implements FormValueControl<string> {
  readonly value = model('');
  readonly label = input('Label');
  readonly placeholder = input('Select an option');
  readonly options = input.required<readonly UiSelectOption[]>();
  readonly hint = input('');
  readonly error = input('');
  readonly disabled = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();
  protected readonly expanded = signal(false);
  protected readonly selectedValues = computed(() => (this.value() ? [this.value()] : []));
  protected readonly selectedLabel = computed(
    () => this.options().find((option) => option.value === this.value())?.label ?? '',
  );
  protected readonly controlId = `ui-select-${nextSelectId++}`;
  protected readonly labelId = `${this.controlId}-label`;
  protected readonly descriptionId = `${this.controlId}-description`;

  protected selectValue(values: string[]) {
    const selected = values.at(0);
    if (selected) {
      this.value.set(selected);
      this.expanded.set(false);
    }
  }
}
