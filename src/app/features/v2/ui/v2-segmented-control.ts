import { Component, input, model } from '@angular/core';

export interface V2SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** One segment that can't be picked yet (e.g. an unfinished option). */
  readonly disabled?: boolean;
}

// Segmented control from the Leads board (Main.dc.html, Period group: SEG / SEG_ON / SEG_OFF).
// A group of toggle buttons; the selected one is a raised `surface` segment.
@Component({
  selector: 'app-v2-segmented-control',
  template: `
    @for (option of options(); track option.value) {
      <button
        type="button"
        class="v2-segmented__segment"
        [class.v2-segmented__segment--selected]="option.value === value()"
        [attr.aria-pressed]="option.value === value()"
        [disabled]="disabled() || option.disabled"
        (click)="value.set(option.value)"
      >
        {{ option.label }}
      </button>
    }
  `,
  host: { role: 'group', '[attr.aria-label]': 'ariaLabel()' },
  styles: `
    @use '../../../../styles/v2/interactive';

    :host {
      display: flex;
      gap: 2px;
      padding: var(--v2-space-1);
      background: var(--v2-ground);
      border-radius: var(--v2-radius-sm);
    }

    .v2-segmented__segment {
      height: var(--v2-control-sm);
      padding: 0 14px;
      background: transparent;
      border: 0;
      border-radius: var(--v2-radius-xs);
      color: var(--v2-muted);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;

      @include interactive.states(ghost);
    }

    .v2-segmented__segment:hover#{interactive.$enabled} {
      color: var(--v2-ink);
    }

    .v2-segmented__segment--selected {
      background: var(--v2-surface);
      color: var(--v2-ink);
      font-weight: 600;
      box-shadow:
        var(--v2-shadow-control),
        0 0 0 1px var(--v2-line);
    }

    // The raised segment is already chosen: no hover tint on it.
    .v2-segmented__segment--selected:hover {
      background-image: none;
    }
  `,
})
export class V2SegmentedControl<T extends string> {
  readonly options = input.required<readonly V2SegmentOption<T>[]>();
  readonly value = model.required<T>();
  readonly ariaLabel = input.required<string>();
  readonly disabled = input(false);
}
