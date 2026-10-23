import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2_NAV_ITEMS, type V2NavLinkItem } from '../shell/v2-nav.config';

export type V2SalesSection = 'leads' | 'projects' | 'clients';

const SECTIONS: readonly V2NavLinkItem[] = (['leads', 'projects', 'clients'] as const).map((id) =>
  V2_NAV_ITEMS.find((item): item is V2NavLinkItem => item.kind === 'link' && item.id === id)!,
);

// Page heading of the Sales screens (Main.dc.html, PAGE; Clients-list.dc.html): the SALES eyebrow
// over the Leads / Projects / Clients tabs, the current one underlined. Routes come from the nav
// config, so a section moving to v2 needs no change here.
@Component({
  selector: 'app-v2-sales-tabs',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="v2-sales__eyebrow">{{ 'v2.nav.section.sales' | translate }}</div>
    <nav class="v2-sales__tabs" [attr.aria-label]="'v2.leads.salesSections' | translate">
      @for (tab of sections; track tab.id) {
        <a
          class="v2-sales__tab"
          [class.v2-sales__tab--current]="tab.id === current()"
          [routerLink]="tab.route"
          [attr.aria-current]="tab.id === current() ? 'page' : null"
          >{{ tab.labelKey | translate }}</a
        >
      }
    </nav>
  `,
  host: { class: 'v2-sales' },
  styles: `
    @use '../../../../styles/v2/interactive';
    @use '../../../../styles/v2/type';

    // The 28px gap between tabs and the 3px underline are board values without a token.
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-2);
    }

    .v2-sales__eyebrow {
      @include type.text(eyebrow);

      color: var(--v2-muted);
    }

    .v2-sales__tabs {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      column-gap: 28px;
    }

    .v2-sales__tab {
      @include type.text(lead-name);

      padding-bottom: var(--v2-space-2);
      border-bottom: 3px solid transparent;
      color: var(--v2-muted);
      font-weight: 500;
      text-decoration: none;

      @include interactive.transition;

      &:hover {
        color: var(--v2-ink);
      }

      &:focus-visible {
        border-radius: 2px;
        @include interactive.focus-ring;
      }
    }

    .v2-sales__tab--current {
      border-bottom-color: var(--v2-ink);
      color: var(--v2-ink);
      font-weight: 600;
    }
  `,
})
export class V2SalesTabs {
  readonly current = input.required<V2SalesSection>();
  protected readonly sections = SECTIONS;
}
