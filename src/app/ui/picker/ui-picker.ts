import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  STANDARD_DROPDOWN_BELOW_POSITIONS,
} from '@angular/cdk/overlay';
import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';

import { UiIcon, type UiIconName } from '@ui/icon/ui-icon';

export interface UiPickerOption {
  readonly value: string;
  readonly label: string;
  /** Decorative short text shown before the label, for example an emoji flag. */
  readonly leading?: string;
  readonly disabled?: boolean;
}

@Component({
  selector: 'app-ui-picker',
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
  templateUrl: './ui-picker.html',
  styleUrl: './ui-picker.scss',
})
export class UiPicker {
  readonly value = model('');
  readonly options = input.required<readonly UiPickerOption[]>();
  readonly ariaLabel = input.required<string>();
  readonly placeholder = input('Select an option');
  readonly disabled = input(false);
  readonly triggerIcon = input<UiIconName>('tune');

  protected readonly expanded = signal(false);
  protected readonly dropdownPositions = STANDARD_DROPDOWN_BELOW_POSITIONS;
  protected readonly unavailable = computed(() => this.disabled() || this.options().length === 0);
  protected readonly selectedValues = computed(() => (this.value() ? [this.value()] : []));
  protected readonly selectedOption = computed(
    () => this.options().find((option) => option.value === this.value()) ?? null,
  );
  protected readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected selectValue(values: string[]): void {
    const selected = values.at(0);
    if (!selected) return;

    this.value.set(selected);
    this.expanded.set(false);
    this.trigger()?.nativeElement.focus();
  }

  protected close(): void {
    this.expanded.set(false);
  }

  protected closeFromKeyboard(event: Event): void {
    event.preventDefault();
    this.expanded.set(false);
    this.trigger()?.nativeElement.focus();
  }
}
