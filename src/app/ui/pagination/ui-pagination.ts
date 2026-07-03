import { Component, computed, input, model } from '@angular/core';
import { UiIcon } from '../icon/ui-icon';

@Component({
  selector: 'app-ui-pagination',
  imports: [UiIcon],
  template: `
    <nav class="ui-pagination" aria-label="Pagination">
      <button
        type="button"
        aria-label="Previous page"
        [disabled]="page() === 0"
        (click)="go(page() - 1)"
      >
        <app-ui-icon name="chevron_left" [size]="18" />
      </button>
      @for (pageNumber of pages(); track pageNumber) {
        <button
          type="button"
          [class.ui-pagination__active]="pageNumber === page()"
          [attr.aria-current]="pageNumber === page() ? 'page' : null"
          [attr.aria-label]="'Page ' + (pageNumber + 1)"
          (click)="go(pageNumber)"
        >
          {{ pageNumber + 1 }}
        </button>
      }
      <button
        type="button"
        aria-label="Next page"
        [disabled]="page() >= pageCount() - 1"
        (click)="go(page() + 1)"
      >
        <app-ui-icon name="chevron_right" [size]="18" />
      </button>
    </nav>
  `,
  styles: `
    .ui-pagination {
      display: flex;
      align-items: center;
      gap: var(--ui-space-1);
    }

    button {
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--ui-radius-sm);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    button:hover:not(:disabled) {
      background: var(--ui-surface-muted);
      color: var(--ui-text);
    }

    .ui-pagination__active {
      border-color: color-mix(in srgb, var(--ui-action) 20%, white);
      background: color-mix(in srgb, var(--ui-action) 9%, white);
      color: var(--ui-action);
    }

    button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  `,
})
export class UiPagination {
  readonly page = model(0);
  readonly pageSize = input(10);
  readonly total = input(0);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );
  protected readonly pages = computed(() =>
    Array.from({ length: this.pageCount() }, (_, index) => index),
  );

  protected go(nextPage: number) {
    if (nextPage >= 0 && nextPage < this.pageCount()) {
      this.page.set(nextPage);
    }
  }
}
