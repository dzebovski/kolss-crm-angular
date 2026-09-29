import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Component, computed, inject, output } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { ImpersonationService } from '@core/auth/impersonation.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isSuperAdminRole, ROLE_OFFICE_MEMBER } from '@core/roles/roles';
import { SessionService } from '@core/session/session.service';
import type { LocaleCode } from '@domain/i18n.types';

/** Actions the account menu hands to the shell (same calls as the side menu). */
export type V2AccountAction = 'impersonate' | 'logout';

// Segment order and labels of the Language row on the board: EN · PL · UA.
const ACCOUNT_LANGUAGES: readonly { readonly code: LocaleCode; readonly label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'pl', label: 'PL' },
  { code: 'uk', label: 'UA' },
];

const PROFILE_VALUE = 'profile';
const LOGOUT_VALUE = 'logout';
const IMPERSONATE_VALUE = 'impersonate';
const LOCALE_PREFIX = 'locale:';

// Account button + menu from the "KOLSS CRM v2" canvas (Main.dc.html, "Current user";
// open state on Leads-account-menu.dc.html): name, role, email · My profile (disabled, the
// page is not designed) · Language · Log in as another user (super admins) · Log out.
// Language switches like the side menu; the other actions go to the shell.
@Component({
  selector: 'app-v2-account-menu',
  imports: [Menu, MenuContent, MenuItem, MenuTrigger, TranslatePipe],
  template: `
    <button
      type="button"
      class="v2-account__trigger"
      ngMenuTrigger
      [menu]="menu"
      [attr.aria-label]="accountLabel()"
    >
      <span class="v2-account__avatar" aria-hidden="true">{{ initial() }}</span>
      <span class="v2-account__text" aria-hidden="true">
        <span class="v2-account__name">{{ displayName() }}</span>
        <span class="v2-account__role">{{ roleName() }}</span>
      </span>
      <svg
        class="v2-account__chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <div
      ngMenu
      #menu="ngMenu"
      class="v2-account__panel"
      [class.v2-account__panel--visible]="menu.visible()"
      [attr.aria-label]="'v2.account.menu' | translate"
      (itemSelected)="select($event)"
    >
      <ng-template ngMenuContent>
        <div class="v2-account__identity">
          <span class="v2-account__avatar v2-account__avatar--lg" aria-hidden="true">
            {{ initial() }}
          </span>
          <span class="v2-account__identity-text">
            <span class="v2-account__identity-name">{{ displayName() }}</span>
            <span class="v2-account__meta">{{ roleName() }}</span>
            @if (email(); as address) {
              <span class="v2-account__meta">{{ address }}</span>
            }
          </span>
        </div>

        <!-- TODO(v2): the profile page is not designed yet (owner file). -->
        <button
          type="button"
          ngMenuItem
          class="v2-account__item"
          [value]="profileValue"
          [disabled]="true"
          [attr.title]="'v2.account.comingSoon' | translate"
        >
          <svg
            class="v2-account__icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <span class="v2-account__label">{{ 'v2.account.profile' | translate }}</span>
          <span class="v2-account__hint">{{ 'v2.account.comingSoon' | translate }}</span>
        </button>

        <div class="v2-account__row">
          <svg
            class="v2-account__icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
          </svg>
          <span class="v2-account__label">{{ 'v2.nav.language' | translate }}</span>
          <div
            class="v2-account__segments"
            role="group"
            [attr.aria-label]="'v2.nav.language' | translate"
          >
            @for (language of languages; track language.code) {
              <button
                type="button"
                ngMenuItem
                role="menuitemradio"
                class="v2-account__segment"
                [class.v2-account__segment--on]="language.code === locale()"
                [value]="localePrefix + language.code"
                [attr.aria-checked]="language.code === locale()"
              >
                {{ language.label }}
              </button>
            }
          </div>
        </div>

        @if (canImpersonate()) {
          <button type="button" ngMenuItem class="v2-account__item" [value]="impersonateValue">
            <svg
              class="v2-account__icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20a6.5 6.5 0 0 1 11-4.7" />
              <path d="M16 14h6" />
              <path d="M19 11l3 3-3 3" />
            </svg>
            <span class="v2-account__label">{{ 'v2.nav.impersonate' | translate }}</span>
          </button>
        }

        <div class="v2-account__divider" aria-hidden="true"></div>

        <button type="button" ngMenuItem class="v2-account__item" [value]="logoutValue">
          <svg
            class="v2-account__icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
            <path d="M10 16l-4-4 4-4" />
            <path d="M6 12h10" />
          </svg>
          <span class="v2-account__label">{{ 'v2.nav.logout' | translate }}</span>
        </button>
      </ng-template>
    </div>
  `,
  styleUrl: './v2-account-menu.scss',
})
export class V2AccountMenu {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly i18n = inject(I18nService);

  readonly action = output<V2AccountAction>();

  protected readonly languages = ACCOUNT_LANGUAGES;
  protected readonly locale = this.session.locale;
  protected readonly profileValue = PROFILE_VALUE;
  protected readonly impersonateValue = IMPERSONATE_VALUE;
  protected readonly logoutValue = LOGOUT_VALUE;
  protected readonly localePrefix = LOCALE_PREFIX;

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
  protected readonly email = computed(() => this.auth.sessionContext()?.user.email ?? '');
  protected readonly initial = computed(
    () => Array.from(this.displayName().trim())[0]?.toLocaleUpperCase() ?? '',
  );
  protected readonly accountLabel = computed(() =>
    this.i18n.t('v2.header.account', { name: this.displayName(), role: this.roleName() }),
  );

  // As the side menu: impersonation is offered to super admins, and not while impersonating
  // (the banner has "Back to my account").
  protected readonly canImpersonate = computed(
    () => isSuperAdminRole(this.auth.profile()?.role) && !this.impersonation.isActive(),
  );

  protected select(value: string): void {
    if (value.startsWith(LOCALE_PREFIX)) {
      this.session.setLocale(value.slice(LOCALE_PREFIX.length) as LocaleCode);
      return;
    }
    if (value === IMPERSONATE_VALUE || value === LOGOUT_VALUE) this.action.emit(value);
  }
}
