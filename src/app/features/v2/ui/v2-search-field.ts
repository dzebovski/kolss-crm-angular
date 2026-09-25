import { Component, input, model } from '@angular/core';

// Search field from the Leads board (Main.dc.html, Filters): 40px input with a leading
// magnifier. Width comes from the consumer (300px on the board). Debounce is the consumer's.
@Component({
  selector: 'app-v2-search-field',
  template: `
    <svg class="v2-search__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
    <input
      type="search"
      class="v2-search__input"
      [attr.aria-label]="ariaLabel()"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="onInput($event)"
    />
  `,
  styles: `
    @use '../../../../styles/v2/interactive';

    :host {
      position: relative;
      display: flex;
      align-items: center;
    }

    .v2-search__icon {
      position: absolute;
      left: var(--v2-space-3);
      fill: none;
      stroke: var(--v2-muted);
      stroke-width: 1.75;
      stroke-linecap: round;
      pointer-events: none;
    }

    .v2-search__input {
      width: 100%;
      height: var(--v2-control-md);
      box-sizing: border-box;
      padding: 0 var(--v2-space-3) 0 38px;
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-ink);
      font-family: inherit;
      font-size: 14px;

      @include interactive.transition;

      &::placeholder {
        color: var(--v2-muted);
      }

      &:hover {
        border-color: var(--v2-line-hover);
      }

      &:focus-visible {
        border-color: var(--v2-ink);
        outline: 2px solid var(--v2-ink);
        outline-offset: -1px;
      }
    }
  `,
})
export class V2SearchField {
  readonly value = model('');
  readonly ariaLabel = input.required<string>();
  readonly placeholder = input('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
