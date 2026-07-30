import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  STANDARD_DROPDOWN_BELOW_POSITIONS,
} from '@angular/cdk/overlay';
import { Component, computed, input, model, output, signal } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { UiIcon } from '@ui/icon/ui-icon';

export interface UiMultiSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

let nextMultiSelectId = 0;

@Component({
  selector: 'app-ui-multi-select',
  imports: [
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    Listbox,
    Option,
    UiIcon,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
  ],
  template: `
    <label class="ui-multi-select__label" [id]="labelId" [for]="controlId">
      {{ label() }}
      @if (required()) {
        <span aria-hidden="true">*</span>
      }
    </label>
    <div class="ui-multi-select__root">
      <button
        type="button"
        [id]="controlId"
        ngCombobox
        #combobox="ngCombobox"
        cdkOverlayOrigin
        #origin="cdkOverlayOrigin"
        class="ui-multi-select__trigger"
        [class.ui-multi-select__trigger--invalid]="invalid() || !!error()"
        [(expanded)]="expanded"
        [disabled]="disabled()"
        [attr.aria-labelledby]="labelId"
        [attr.aria-invalid]="invalid() || !!error()"
        [attr.aria-describedby]="error() || hint() ? descriptionId : null"
        (blur)="touch.emit()"
      >
        <span [class.ui-multi-select__placeholder]="!triggerLabel()">
          {{ triggerLabel() || placeholder() }}
        </span>
        <app-ui-icon name="keyboard_arrow_down" [size]="20" />
      </button>

      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin"
        [cdkConnectedOverlayOpen]="expanded()"
        [cdkConnectedOverlayMatchWidth]="true"
        [cdkConnectedOverlayHasBackdrop]="false"
        [cdkConnectedOverlayPositions]="dropdownPositions"
        [cdkConnectedOverlayOffsetY]="8"
        [cdkConnectedOverlayPanelClass]="'ui-multi-select__overlay-pane'"
        (overlayOutsideClick)="expanded.set(false)"
      >
        <ng-template ngComboboxPopup [combobox]="combobox">
          <ul
            ngComboboxWidget
            ngListbox
            #listbox="ngListbox"
            class="ui-multi-select__options"
            focusMode="activedescendant"
            selectionMode="explicit"
            [multi]="true"
            [value]="listboxValue()"
            [activeDescendant]="listbox.activeDescendant()"
            (valueChange)="value.set($event)"
          >
            @for (option of options(); track option.value) {
              <li
                ngOption
                class="ui-multi-select__option"
                [value]="option.value"
                [label]="option.label"
                [disabled]="option.disabled ?? false"
              >
                <span class="ui-multi-select__checkbox" aria-hidden="true">
                  @if (value().includes(option.value)) {
                    <app-ui-icon name="check" [size]="14" />
                  }
                </span>
                <span class="ui-multi-select__option-label">{{ option.label }}</span>
              </li>
            }
          </ul>
        </ng-template>
      </ng-template>
    </div>
    <span
      class="ui-multi-select__message"
      [class.ui-multi-select__message--error]="!!error()"
      [id]="descriptionId"
      [attr.role]="error() ? 'alert' : null"
      [attr.aria-hidden]="error() || hint() ? null : 'true'"
    >
      {{ error() || hint() }}
    </span>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--ui-space-2);
      min-width: 0;
    }

    .ui-multi-select__label {
      font-size: 0.8125rem;
      font-weight: 650;
    }

    .ui-multi-select__label span,
    .ui-multi-select__message--error {
      color: var(--ui-danger);
    }

    .ui-multi-select__root {
      position: relative;
    }

    .ui-multi-select__trigger {
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

    .ui-multi-select__trigger span:first-child {
      min-width: 0;
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ui-multi-select__trigger[aria-expanded='true'] {
      border-color: var(--ui-focus);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-focus) 16%, transparent);
    }

    .ui-multi-select__trigger--invalid {
      border-color: var(--ui-danger);
    }

    .ui-multi-select__trigger:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .ui-multi-select__placeholder,
    .ui-multi-select__message {
      color: var(--ui-text-subtle);
    }

    .ui-multi-select__message {
      min-block-size: 0.9375rem;
      font-size: 0.75rem;
      line-height: 1.25;
    }

    .ui-multi-select__options {
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

    .ui-multi-select__option {
      min-height: 2.25rem;
      padding: 0 var(--ui-space-3);
      border-radius: var(--ui-radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      font-size: 0.875rem;
      transition: background-color var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-multi-select__checkbox {
      flex: 0 0 auto;
      width: 1.125rem;
      height: 1.125rem;
      border: 1.5px solid var(--ui-border-strong);
      border-radius: 0.3rem;
      color: white;
      display: grid;
      place-items: center;
      transition: all var(--ui-duration-fast) var(--ui-ease);
    }

    .ui-multi-select__option[aria-selected='true'] .ui-multi-select__checkbox {
      border-color: var(--ui-action);
      background: var(--ui-action);
    }

    .ui-multi-select__option-label {
      min-width: 0;
      flex: 1 1 auto;
    }

    .ui-multi-select__option[data-active='true']:not([aria-selected='true']),
    .ui-multi-select__option:hover:not([aria-selected='true']) {
      background: var(--ui-surface-subtle);
    }

    .ui-multi-select__option[aria-selected='true'] {
      background: var(--ui-surface-muted);
    }

    .ui-multi-select__option[aria-disabled='true'] {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `,
})
export class UiMultiSelect implements FormValueControl<readonly string[]> {
  readonly value = model<readonly string[]>([]);
  readonly label = input('Label');
  readonly placeholder = input('Select options');
  readonly options = input.required<readonly UiMultiSelectOption[]>();
  readonly hint = input('');
  readonly error = input('');
  readonly disabled = input(false);
  readonly required = input(false);
  readonly invalid = input(false);
  /** Formats the trigger label when more than one option is selected, e.g. `count => "3 обрано"`. */
  readonly selectedSummaryLabel = input<(count: number) => string>((count) => String(count));
  readonly touch = output<void>();
  protected readonly expanded = signal(false);
  protected readonly dropdownPositions = STANDARD_DROPDOWN_BELOW_POSITIONS;
  protected readonly listboxValue = computed(() => [...this.value()]);
  protected readonly controlId = `ui-multi-select-${nextMultiSelectId++}`;
  protected readonly labelId = `${this.controlId}-label`;
  protected readonly descriptionId = `${this.controlId}-description`;

  protected readonly triggerLabel = computed(() => {
    const selected = this.value();
    if (selected.length === 0) return '';
    if (selected.length === 1) {
      return this.options().find((option) => option.value === selected[0])?.label ?? '';
    }
    return this.selectedSummaryLabel()(selected.length);
  });
}
