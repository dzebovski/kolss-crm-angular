import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { roleLabel } from '../../../core/roles/roles';
import type { LocaleCode, OfficeFilter } from '../../../services/crm-mock.types';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiMenu, UiMenuItem } from '../../../ui/menu/ui-menu';

@Component({
  selector: 'app-crm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UiIcon, UiMenu],
  template: `
    <div class="crm-shell" data-density="compact">
      <header class="crm-shell__header">
        <div class="crm-shell__left">
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

          <div class="crm-shell__context-controls" aria-label="CRM controls">
            @if (showOfficeFilter()) {
              <div
                class="crm-shell__segmented crm-shell__segmented--office"
                aria-label="Офісний контекст"
              >
                @for (item of officeFilters(); track item.value) {
                  <button
                    type="button"
                    [class.is-active]="officeFilter() === item.value"
                    (click)="setOfficeFilter(item.value)"
                  >
                    {{ item.label }}
                  </button>
                }
              </div>
            }

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
          </div>
        </div>

        <div class="crm-shell__user" aria-label="Поточний користувач">
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
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--ui-space-5);
      padding: var(--ui-space-3) var(--ui-space-6);
      border-bottom: 1px solid var(--ui-border);
      background: color-mix(in srgb, var(--ui-surface-raised) 96%, transparent);
      backdrop-filter: blur(16px);
    }

    .crm-shell__left,
    .crm-shell__context-controls,
    .crm-shell__user {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-3);
    }

    .crm-shell__left {
      min-width: 0;
      justify-content: flex-start;
    }

    .crm-shell__user {
      justify-self: end;
      white-space: nowrap;
    }

    .crm-shell__brand {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-3);
      color: inherit;
      text-decoration: none;
      font-family: var(--ui-font-display);
      line-height: 1.1;
      flex: 0 0 auto;
    }

    .crm-shell__brand-mark {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: var(--ui-radius-md);
      background: var(--ui-brand-gradient);
      box-shadow: var(--ui-shadow-1);
    }

    .crm-shell__eyebrow {
      display: block;
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ui-text-subtle);
    }

    .crm-shell__nav {
      display: inline-flex;
      gap: var(--ui-space-2);
      flex: 0 0 auto;
    }

    .crm-shell__nav a {
      min-height: 2.5rem;
      padding: 0 var(--ui-space-4);
      border-radius: var(--ui-radius-pill);
      color: var(--ui-text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 650;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-2);
    }

    .crm-shell__nav a.is-active {
      background: var(--ui-action-soft);
      color: var(--ui-action);
    }

    .crm-shell__context-controls {
      min-width: 0;
    }

    .crm-shell__segmented {
      display: inline-flex;
      padding: 0.2rem;
      border-radius: var(--ui-radius-pill);
      background: var(--ui-surface-muted);
      gap: 0.15rem;
    }

    .crm-shell__segmented button {
      min-height: 2rem;
      padding: 0 var(--ui-space-3);
      border: 0;
      border-radius: var(--ui-radius-pill);
      background: transparent;
      color: var(--ui-text-muted);
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
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
    this.auth.profile()?.display_name ?? this.auth.sessionContext()?.user.email ?? 'Користувач';
  readonly roleName = () => roleLabel(this.auth.profile()?.role ?? 'office_member');
  readonly canManageAccounts = () => this.session.officeContext()?.isSuperAdmin ?? false;
  readonly showOfficeFilter = this.session.showOfficeFilter;
  readonly officeFilter = this.session.officeFilter;
  readonly locale = this.session.locale;

  protected readonly officeFilters = computed(() => {
    const offices = this.session.officeContext()?.filterOffices ?? [];
    const items: { value: OfficeFilter; label: string }[] = [{ value: 'all', label: 'Усі офіси' }];
    for (const office of offices) {
      if (office.code === 'kyiv' || office.code === 'warsaw') {
        items.push({
          value: office.code,
          label: office.name_uk,
        });
      }
    }
    return items;
  });

  protected setOfficeFilter(filter: OfficeFilter): void {
    this.session.setOfficeFilter(filter);
  }

  protected setLocale(locale: LocaleCode): void {
    this.session.setLocale(locale);
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
