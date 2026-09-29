import { Component, ElementRef, input, model, viewChild } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';

// Search field from the Leads board (Main.dc.html, Filters): 40px input with a leading
// magnifier. Width comes from the consumer (300px on the board). Debounce is the consumer's.
@Component({
  selector: 'app-v2-search-field',
  imports: [TranslatePipe],
  template: `
    <svg class="v2-search__icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
    <input
      #searchInput
      type="search"
      class="v2-search__input"
      [attr.aria-label]="ariaLabel()"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="onInput($event)"
    />
    @if (value()) {
      <button
        type="button"
        class="v2-search__clear"
        [attr.aria-label]="('common.clear' | translate) + ' ' + ariaLabel()"
        (click)="clear()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    }
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
      padding: 0 46px 0 38px;
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

      &::-webkit-search-cancel-button {
        display: none;
      }
    }

    .v2-search__clear {
      position: absolute;
      right: 4px;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: var(--v2-radius-xs);
      background: transparent;
      color: var(--v2-muted);
      cursor: pointer;

      @include interactive.states(ghost);

      &:hover {
        color: var(--v2-ink);
      }

      svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
      }
    }
  `,
})
export class V2SearchField {
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  readonly value = model('');
  readonly ariaLabel = input.required<string>();
  readonly placeholder = input('');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.value.set('');
    this.searchInput().nativeElement.focus();
  }
}
