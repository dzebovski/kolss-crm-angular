import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { SessionService } from '@core/session/session.service';
import { V2AccountMenu, type V2AccountAction } from './v2-account-menu';
import { V2OfficeSwitcher } from './v2-office-switcher';
import { V2_SIDE_MENU_ID } from './v2-side-menu';

// Header from the "KOLSS CRM v2" canvas (Main.dc.html, HEADER): menu toggle, logo, CRM chip,
// office switcher, divider, account menu (V2AccountMenu). Not fixed: it scrolls with the page.
@Component({
  selector: 'app-v2-header',
  imports: [NgOptimizedImage, RouterLink, TranslatePipe, V2AccountMenu, V2OfficeSwitcher],
  template: `
    <header class="v2-header">
      <button
        type="button"
        class="v2-header__toggle"
        [attr.aria-label]="(menuOpen() ? 'v2.header.closeMenu' : 'v2.header.openMenu') | translate"
        [attr.aria-expanded]="menuOpen()"
        [attr.aria-controls]="sideMenuId"
        (click)="menuToggle.emit()"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
          @if (menuOpen()) {
            <path d="M16 10l-2 2 2 2" />
          } @else {
            <path d="M14 10l2 2-2 2" />
          }
        </svg>
      </button>

      <a class="v2-header__logo" routerLink="/v2" [attr.aria-label]="'v2.header.home' | translate">
        <img ngSrc="/v2/kolss-logo.png" width="133" height="20" alt="KOLSS" priority />
      </a>
      <span class="v2-header__product">CRM</span>

      <div class="v2-header__spacer"></div>

      @if (showOfficeSwitcher()) {
        <app-v2-office-switcher />
      }

      <div class="v2-header__divider"></div>

      <app-v2-account-menu (action)="action.emit($event)" />
    </header>
  `,
  styleUrl: './v2-header.scss',
})
export class V2Header {
  private readonly session = inject(SessionService);

  readonly menuOpen = input.required<boolean>();
  readonly menuToggle = output<void>();
  readonly action = output<V2AccountAction>();

  protected readonly sideMenuId = V2_SIDE_MENU_ID;

  protected readonly showOfficeSwitcher = this.session.showOfficeFilter;
}
