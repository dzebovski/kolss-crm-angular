import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { ROLE_OFFICE_MEMBER } from '@core/roles/roles';
import { SessionService } from '@core/session/session.service';
import { V2OfficeSwitcher } from './v2-office-switcher';

// Header from the "KOLSS CRM v2" canvas (Main.dc.html, HEADER): menu toggle, logo, CRM chip,
// office switcher, divider, current user. Not fixed: it scrolls with the page.
@Component({
  selector: 'app-v2-header',
  imports: [NgOptimizedImage, RouterLink, TranslatePipe, V2OfficeSwitcher],
  template: `
    <header class="v2-header">
      <button
        type="button"
        class="v2-header__toggle"
        [attr.aria-label]="(menuOpen() ? 'v2.header.closeMenu' : 'v2.header.openMenu') | translate"
        [attr.aria-expanded]="menuOpen()"
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

      <!-- TODO(v2): what the account button opens is not defined in the design yet. -->
      <button
        type="button"
        class="v2-header__user"
        aria-disabled="true"
        [attr.aria-label]="accountLabel()"
      >
        <span class="v2-header__avatar" aria-hidden="true">{{ initial() }}</span>
        <span class="v2-header__user-text" aria-hidden="true">
          <span class="v2-header__user-name">{{ displayName() }}</span>
          <span class="v2-header__user-role">{{ roleName() }}</span>
        </span>
      </button>
    </header>
  `,
  styleUrl: './v2-header.scss',
})
export class V2Header {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly i18n = inject(I18nService);

  readonly menuOpen = input.required<boolean>();
  readonly menuToggle = output<void>();

  protected readonly showOfficeSwitcher = this.session.showOfficeFilter;

  // Same name and role sources as the v1 header (CrmShell).
  protected readonly displayName = computed(
    () =>
      this.auth.profile()?.display_name ??
      this.auth.sessionContext()?.user.email ??
      this.i18n.t('common.user'),
  );
  protected readonly roleName = computed(() =>
    this.i18n.roleLabel(this.auth.profile()?.role ?? ROLE_OFFICE_MEMBER),
  );
  protected readonly initial = computed(
    () => Array.from(this.displayName().trim())[0]?.toLocaleUpperCase() ?? '',
  );
  protected readonly accountLabel = computed(() =>
    this.i18n.t('v2.header.account', { name: this.displayName(), role: this.roleName() }),
  );
}
