import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { roleLabel } from '../../../core/roles/roles';
import { UiButton } from '../../../ui/button/ui-button';

@Component({
  selector: 'app-crm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UiButton],
  template: `
    <div class="crm-shell" data-density="compact">
      <header class="crm-shell__header">
        <div class="crm-shell__brand">
          <span class="crm-shell__eyebrow">KOLSS</span>
          <strong>CRM</strong>
        </div>

        <nav class="crm-shell__nav" aria-label="Основна навігація">
          <a routerLink="/crm/dashboard" routerLinkActive="is-active">Огляд</a>
          <a routerLink="/crm/leads" routerLinkActive="is-active">Ліди</a>
          <a routerLink="/crm/reports" routerLinkActive="is-active">Звітність</a>
          @if (canManageAccounts()) {
            <a routerLink="/crm/accounts" routerLinkActive="is-active">Акаунти</a>
          }
        </nav>

        <div class="crm-shell__user">
          <div class="crm-shell__user-meta">
            <span>{{ displayName() }}</span>
            <small>{{ roleName() }}</small>
          </div>
          <app-ui-button variant="ghost" size="small" (pressed)="signOut()">Вийти</app-ui-button>
        </div>
      </header>

      <main class="crm-shell__main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .crm-shell {
      min-height: 100dvh;
      display: grid;
      grid-template-rows: auto 1fr;
      background: var(--ui-surface-canvas);
    }

    .crm-shell__header {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--ui-space-6);
      padding: var(--ui-space-4) var(--ui-space-6);
      border-bottom: 1px solid var(--ui-border-subtle);
      background: var(--ui-surface-raised);
    }

    .crm-shell__brand {
      display: grid;
      gap: 0.125rem;
      font-family: var(--ui-font-display);
      font-size: 1.125rem;
    }

    .crm-shell__eyebrow {
      font-size: 0.6875rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ui-ink-muted);
    }

    .crm-shell__nav {
      display: flex;
      gap: var(--ui-space-2);
    }

    .crm-shell__nav a {
      padding: 0.5rem 0.875rem;
      border-radius: var(--ui-radius-pill);
      color: var(--ui-ink-muted);
      text-decoration: none;
      font-weight: 500;
    }

    .crm-shell__nav a.is-active,
    .crm-shell__nav a:hover {
      color: var(--ui-action);
      background: color-mix(in srgb, var(--ui-action) 8%, transparent);
    }

    .crm-shell__user {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
    }

    .crm-shell__user-meta {
      display: grid;
      text-align: right;
      line-height: 1.2;
    }

    .crm-shell__user-meta small {
      color: var(--ui-ink-muted);
    }

    .crm-shell__main {
      padding: var(--ui-space-6);
    }
  `,
})
export class CrmShell {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly displayName = () =>
    this.auth.profile()?.display_name ?? this.auth.sessionContext()?.user.email ?? 'Користувач';
  readonly roleName = () => roleLabel(this.auth.profile()?.role);
  readonly canManageAccounts = () => this.session.officeContext()?.isSuperAdmin ?? false;

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
