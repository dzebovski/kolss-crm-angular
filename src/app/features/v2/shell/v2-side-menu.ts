import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { ImpersonationService } from '@core/auth/impersonation.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { isSuperAdminRole } from '@core/roles/roles';
import { SessionService } from '@core/session/session.service';
import type { LocaleCode } from '@domain/i18n.types';
import { V2NavIcon } from './v2-nav-icon';
import { buildV2Nav, V2_LANGUAGES, type V2NavAction } from './v2-nav.config';

export const V2_SIDE_MENU_ID = 'v2-side-menu';

// Side menu from the "KOLSS CRM v2" canvas (Main.dc.html, SIDE MENU; open on
// Leads-menu-open.dc.html). It pushes the content aside; closed it has zero width and is inert.
// Items come from `V2_NAV_ITEMS`. Language opens an inline uk / pl / en list here; the other
// actions go to the shell.
@Component({
  selector: 'app-v2-side-menu',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, V2NavIcon],
  host: { '[class.v2-menu--open]': 'open()' },
  templateUrl: './v2-side-menu.html',
  styleUrl: './v2-side-menu.scss',
})
export class V2SideMenu {
  private readonly auth = inject(AuthService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly session = inject(SessionService);

  readonly open = input.required<boolean>();
  readonly action = output<Exclude<V2NavAction, 'language'>>();

  protected readonly menuId = V2_SIDE_MENU_ID;
  protected readonly languagesId = `${V2_SIDE_MENU_ID}-languages`;
  protected readonly languages = V2_LANGUAGES;
  protected readonly locale = this.session.locale;

  /** The language list collapses whenever the menu closes. */
  protected readonly languagesOpen = linkedSignal({ source: this.open, computation: () => false });
  private readonly languageTrigger = viewChild<ElementRef<HTMLButtonElement>>('languageTrigger');

  // Same sources as v1: accounts from the `/v1/me` capability (as `superAdminGuard`),
  // impersonation from the role (as the v1 user menu).
  protected readonly groups = computed(() =>
    buildV2Nav({
      canManageUsers: this.auth.me()?.permissions.canManageUsers ?? false,
      canImpersonate: isSuperAdminRole(this.auth.profile()?.role),
      isImpersonating: this.impersonation.isActive(),
    }),
  );

  protected readonly languageName = computed(
    () => V2_LANGUAGES.find((language) => language.code === this.locale())?.name ?? '',
  );

  protected toggleLanguages(): void {
    this.languagesOpen.update((open) => !open);
  }

  // Same call as the v1 user menu. The list closes; focus goes back to the Language item.
  protected selectLanguage(locale: LocaleCode): void {
    this.session.setLocale(locale);
    this.languagesOpen.set(false);
    this.languageTrigger()?.nativeElement.focus();
  }
}
