import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { SessionService } from '@core/session/session.service';
import { V2AccountMenu, type V2AccountAction } from './v2-account-menu';
import type { V2Workspace } from './v2-nav.config';
import { V2OfficeSwitcher } from './v2-office-switcher';
import { V2_SIDE_MENU_ID } from './v2-side-menu';

// Header from the "KOLSS CRM v2" canvas (Main.dc.html, HEADER): menu toggle, logo, workspace switcher,
// office switcher, divider, account menu (V2AccountMenu). Not fixed: it scrolls with the page.
@Component({
  selector: 'app-v2-header',
  imports: [
    NgOptimizedImage,
    RouterLink,
    TranslatePipe,
    V2AccountMenu,
    V2OfficeSwitcher,
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
  ],
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

      <a class="v2-header__logo" [routerLink]="workspace() === 'CRM' ? '/v2' : '/hr'">
        <img ngSrc="/v2/kolss-logo.png" width="133" height="20" alt="KOLSS" priority />
      </a>
      <div class="v2-header__workspace">
        <button type="button" class="v2-header__product" ngMenuTrigger [menu]="workspaceMenu">
          {{ currentWorkspaceLabel() | translate }}
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div
          ngMenu
          #workspaceMenu="ngMenu"
          class="v2-header__workspace-menu"
          [class.is-open]="workspaceMenu.visible()"
          [attr.aria-label]="'v2.header.workspace' | translate"
        >
          <ng-template ngMenuContent>
            @for (option of workspaces; track option.id) {
              <a
                ngMenuItem
                [value]="option.id"
                [routerLink]="option.route"
                [attr.aria-current]="workspace() === option.id ? 'true' : null"
              >
                {{ option.label | translate }}
              </a>
            }
          </ng-template>
        </div>
      </div>

      <div class="v2-header__spacer"></div>

      @if (workspace() === 'CRM' && showOfficeSwitcher()) {
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

  readonly workspace = input<V2Workspace>('CRM');
  // CRM v2 is the main CRM; the v1 CRM stays reachable as "CRM Old" (it has no workspace of its own
  // in the v2 shell, so it is never the current item here).
  protected readonly workspaces = [
    { id: 'CRM', label: 'v2.header.workspaceCrm', route: '/v2' },
    { id: 'CRM_OLD', label: 'v2.header.workspaceCrmOld', route: '/leads' },
    { id: 'HR', label: 'v2.header.workspaceHr', route: '/hr' },
  ] as const;
  protected readonly currentWorkspaceLabel = computed(
    () =>
      this.workspaces.find((option) => option.id === this.workspace())?.label ??
      'v2.header.workspaceCrm',
  );

  readonly menuOpen = input.required<boolean>();
  readonly menuToggle = output<void>();
  readonly action = output<V2AccountAction>();

  protected readonly sideMenuId = V2_SIDE_MENU_ID;

  protected readonly showOfficeSwitcher = this.session.showOfficeFilter;
}
