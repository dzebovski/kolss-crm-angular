import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { roleLabel } from '../../../core/roles/roles';
import { CrmMockService } from '../../../services/crm-mock.service';
import type { LocaleCode, OfficeFilter } from '../../../services/crm-mock.types';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiMenu, UiMenuItem } from '../../../ui/menu/ui-menu';

@Component({
  selector: 'app-crm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UiIcon, UiMenu],
  template: `
    <div class="crm-shell" data-density="compact">
      <header class="crm-shell__header">
        <a class="crm-shell__brand" routerLink="/crm/leads" aria-label="KOLSS CRM">
          <span class="crm-shell__brand-mark" aria-hidden="true"></span>
          <span>
            <span class="crm-shell__eyebrow">KOLSS</span>
            <strong>CRM</strong>
          </span>
        </a>

        <nav class="crm-shell__nav" aria-label="Основна навігація">
          <a routerLink="/crm/leads" routerLinkActive="is-active">
            <app-ui-icon name="view_kanban" [size]="17" />
            Ліди
          </a>
          <a routerLink="/crm/reports" routerLinkActive="is-active">
            <app-ui-icon name="automation" [size]="17" />
            Звітність
          </a>
          @if (canManageAccounts()) {
            <a routerLink="/crm/accounts" routerLinkActive="is-active">
              <app-ui-icon name="history" [size]="17" />
              Акаунти
            </a>
          }
        </nav>

        <div class="crm-shell__tools" aria-label="CRM controls">
          <div class="crm-shell__segmented" aria-label="Офісний контекст">
            @for (item of officeFilters; track item.value) {
              <button
                type="button"
                [class.is-active]="officeFilter() === item.value"
                (click)="setOfficeFilter(item.value)"
              >
                {{ item.label }}
              </button>
            }
          </div>

          <div class="crm-shell__segmented crm-shell__segmented--language" aria-label="Мова">
            @for (item of locales; track item.value) {
              <button
                type="button"
                [class.is-active]="locale() === item.value"
                (click)="setLocale(item.value)"
              >
                {{ item.label }}
              </button>
            }
          </div>

          <div class="crm-shell__user-meta">
            <span>{{ displayName() }}</span>
            <small>{{ roleName() }}</small>
          </div>
          <app-ui-menu label="Меню" [items]="userMenuItems" (selected)="handleUserMenu($event)" />
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
      background: linear-gradient(180deg, var(--ui-surface-subtle), var(--ui-surface-canvas) 18rem);
    }

    .crm-shell__header {
      position: sticky;
      top: 0;
      z-index: var(--ui-z-header);
      display: grid;
      grid-template-columns: auto minmax(20rem, 1fr) auto;
      align-items: center;
      gap: var(--ui-space-5);
      padding: var(--ui-space-3) var(--ui-space-6);
      border-bottom: 1px solid var(--ui-border);
      background: color-mix(in srgb, var(--ui-surface-raised) 96%, transparent);
      backdrop-filter: blur(16px);
    }

    .crm-shell__brand {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
      font-family: var(--ui-font-display);
      font-size: 1.125rem;
      color: var(--ui-text);
      text-decoration: none;
    }

    .crm-shell__brand-mark {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: var(--ui-radius-md);
      background:
        linear-gradient(135deg, rgb(255 255 255 / 70%), transparent 48%), var(--ui-brand-gradient);
      box-shadow: var(--ui-shadow-1);
    }

    .crm-shell__eyebrow {
      display: block;
      font-size: 0.6875rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ui-text-subtle);
    }

    .crm-shell__nav {
      display: flex;
      gap: var(--ui-space-2);
    }

    .crm-shell__nav a {
      min-height: 2.25rem;
      padding: 0 var(--ui-space-3);
      border-radius: var(--ui-radius-md);
      color: var(--ui-text-muted);
      text-decoration: none;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
      transition:
        background var(--ui-duration-fast) var(--ui-ease),
        color var(--ui-duration-fast) var(--ui-ease);
    }

    .crm-shell__nav a.is-active,
    .crm-shell__nav a:hover {
      color: var(--ui-action);
      background: color-mix(in srgb, var(--ui-action) 8%, transparent);
    }

    .crm-shell__tools {
      display: flex;
      align-items: center;
      gap: var(--ui-space-3);
    }

    .crm-shell__segmented {
      min-height: 2rem;
      padding: 0.1875rem;
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-subtle);
      display: inline-flex;
      gap: 0.125rem;
    }

    .crm-shell__segmented button {
      min-width: 3rem;
      padding: 0 var(--ui-space-2);
      border: 0;
      border-radius: calc(var(--ui-radius-md) - 0.1875rem);
      background: transparent;
      color: var(--ui-text-muted);
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .crm-shell__segmented button.is-active {
      background: var(--ui-surface-raised);
      color: var(--ui-action);
      box-shadow: var(--ui-shadow-1);
    }

    .crm-shell__segmented--language button {
      min-width: 2.25rem;
      text-transform: uppercase;
    }

    .crm-shell__user-meta {
      display: grid;
      text-align: right;
      line-height: 1.2;
      min-width: 8rem;
    }

    .crm-shell__user-meta small {
      color: var(--ui-text-subtle);
    }

    .crm-shell__main {
      width: min(100%, 96rem);
      margin: 0 auto;
      padding: var(--ui-space-6);
    }
  `,
})
export class CrmShell {
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly crm = inject(CrmMockService);

  protected readonly officeFilters: readonly { value: OfficeFilter; label: string }[] = [
    { value: 'all', label: 'Усі офіси' },
    { value: 'kyiv', label: 'Київ' },
    { value: 'warsaw', label: 'Варшава' },
  ];
  protected readonly locales: readonly { value: LocaleCode; label: string }[] = [
    { value: 'uk', label: 'UK' },
    { value: 'pl', label: 'PL' },
    { value: 'en', label: 'EN' },
  ];
  protected readonly userMenuItems: readonly UiMenuItem[] = [
    { value: 'design', label: 'Дизайн-система', icon: 'view_kanban' },
    { value: 'logout', label: 'Вийти', icon: 'arrow_back' },
  ];

  readonly displayName = () =>
    this.auth.profile()?.display_name ??
    this.auth.sessionContext()?.user.email ??
    this.crm.currentEmployee().displayName;
  readonly roleName = () => roleLabel(this.auth.profile()?.role ?? this.crm.currentEmployee().role);
  readonly canManageAccounts = () => this.session.officeContext()?.isSuperAdmin ?? false;
  readonly officeFilter = this.crm.officeFilter;
  readonly locale = this.crm.locale;

  protected setOfficeFilter(filter: OfficeFilter): void {
    this.crm.setOfficeFilter(filter);
  }

  protected setLocale(locale: LocaleCode): void {
    this.crm.setLocale(locale);
  }

  protected async handleUserMenu(value: string): Promise<void> {
    if (value === 'design') {
      await this.router.navigateByUrl('/design');
      return;
    }
    if (value === 'logout') {
      await this.signOut();
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
