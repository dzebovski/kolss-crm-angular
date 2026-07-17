import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UiIcon } from '../../ui/icon/ui-icon';

@Component({
  selector: 'app-design-header',
  imports: [RouterLink, RouterLinkActive, UiIcon],
  template: `
    <header class="design-header">
      <a class="design-brand" routerLink="/design" aria-label="KOLSS Design home">
        <span class="design-brand__mark" aria-hidden="true"></span>
        <span>KOLSS</span>
        <small>Design system</small>
      </a>

      <nav class="design-nav" aria-label="Design system navigation">
        <a
          routerLink="/design"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Catalog</a
        >
        <a routerLink="/design/radial-menu" routerLinkActive="is-active">Radial Menu</a>
      </nav>

      <div class="design-header__actions">
        <ng-content />
        <a class="design-home-link" routerLink="/">
          <app-ui-icon name="arrow_back" [size]="17" />
          Starter
        </a>
      </div>
    </header>
  `,
})
export class DesignHeader {}
