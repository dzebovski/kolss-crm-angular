import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { ImpersonationService } from '@core/auth/impersonation.service';
import { I18nService } from '@core/i18n/i18n.service';
import { V2Header } from './v2-header';
import { V2ImpersonationBanner } from './v2-impersonation-banner';
import { readV2MenuOpen, writeV2MenuOpen } from './v2-menu.storage';
import type { V2NavAction } from './v2-nav.config';
import { V2SideMenu } from './v2-side-menu';

// v2 layout frame from the "KOLSS CRM v2" canvas (Main.dc.html): impersonation banner (v1
// behaviour, not drawn), header (N1), body row with the side menu (N2) that pushes main aside.
// The host carries the v2 tokens (F2). Menu actions behave as in the v1 shell (N3).
@Component({
  selector: 'app-v2-shell',
  imports: [RouterOutlet, V2Header, V2ImpersonationBanner, V2SideMenu],
  host: { class: 'v2-root' },
  template: `
    @if (impersonating()) {
      <app-v2-impersonation-banner [name]="displayName()" (stop)="stopImpersonation()" />
    }
    <app-v2-header [menuOpen]="menuOpen()" (menuToggle)="toggleMenu()" />
    <div class="v2-shell__body">
      <app-v2-side-menu [open]="menuOpen()" (action)="runNavAction($event)" />
      <main class="v2-shell__main">
        <router-outlet />
      </main>
    </div>
  `,
  styleUrl: './v2-shell.scss',
})
export class V2Shell {
  private readonly auth = inject(AuthService);
  private readonly impersonation = inject(ImpersonationService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  // Closed by default, as on the Main board; then the viewer's last choice.
  protected readonly menuOpen = signal(readV2MenuOpen());

  protected readonly impersonating = this.impersonation.isActive;
  protected readonly displayName = computed(
    () =>
      this.auth.profile()?.display_name ??
      this.auth.sessionContext()?.user.email ??
      this.i18n.t('common.user'),
  );

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    writeV2MenuOpen(this.menuOpen());
  }

  protected async runNavAction(action: Exclude<V2NavAction, 'language'>): Promise<void> {
    switch (action) {
      case 'impersonate':
        // TODO(v2, N3): open the v2 impersonation popup once the K3 dialog shell is merged.
        return;
      case 'stop-impersonation':
        this.stopImpersonation();
        return;
      case 'logout':
        await this.auth.signOut();
        await this.router.navigateByUrl('/login');
        return;
    }
  }

  // As v1: the session reloads so every resource refetches as the real user.
  protected stopImpersonation(): void {
    this.impersonation.stop();
    globalThis.location.reload();
  }
}
