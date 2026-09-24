import { Component, model } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2_LEAD_PRODUCTS } from '@domain/v2/lead-card.mapper';
import type { V2LeadProduct } from '@domain/v2/lead-card.types';
import { V2_PRODUCT_LABEL } from '../../ui/v2-lead-labels';

let nextId = 0;

// "Product · one or more" chips of the Lead info and Successful call popups (lead card v1.3):
// 32px pill toggles, `surface` + `line-strong` off, `ink` fill + `on-ink` text on (design
// system README, Controls).
@Component({
  selector: 'app-v2-product-chips',
  imports: [TranslatePipe],
  template: `
    <span class="v2-products__label" [id]="labelId">{{ 'v2.leadInfo.products' | translate }}</span>
    <div class="v2-products__chips" role="group" [attr.aria-labelledby]="labelId">
      @for (product of products; track product) {
        <button
          type="button"
          class="v2-products__chip"
          [class.v2-products__chip--on]="selected().includes(product)"
          [attr.aria-pressed]="selected().includes(product)"
          (click)="toggle(product)"
        >
          {{ labels[product] | translate }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-2);
    }

    .v2-products__label {
      color: var(--v2-muted);
      font-size: 12px;
    }

    .v2-products__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .v2-products__chip {
      height: var(--v2-control-sm);
      padding: 0 var(--v2-space-3);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-pill);
      background: var(--v2-surface);
      color: var(--v2-ink);
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--v2-ink);
        outline-offset: 2px;
      }
    }

    .v2-products__chip--on {
      border-color: var(--v2-ink);
      background: var(--v2-ink);
      color: var(--v2-on-ink);
    }
  `,
})
export class V2ProductChips {
  readonly selected = model.required<readonly V2LeadProduct[]>();

  protected readonly products = V2_LEAD_PRODUCTS;
  protected readonly labels = V2_PRODUCT_LABEL;
  protected readonly labelId = `v2-products-${nextId++}`;

  protected toggle(product: V2LeadProduct): void {
    this.selected.update((current) =>
      current.includes(product)
        ? current.filter((item) => item !== product)
        : V2_LEAD_PRODUCTS.filter((item) => item === product || current.includes(item)),
    );
  }
}
