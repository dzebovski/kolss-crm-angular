import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ImpersonationService } from '../../../core/auth/impersonation.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { isSuperAdminRole } from '../../../core/roles/roles';
import { SessionService } from '../../../core/session/session.service';
import type { LocaleCode, OfficeFilter } from '../../../services/crm-mock.types';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { UiMenu, type UiMenuItem } from '../../../ui/menu/ui-menu';
import { UiUser } from '../../../ui/user/ui-user';
import { ImpersonationDialog } from './impersonation-dialog';

@Component({
  selector: 'app-crm-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    UiIcon,
    UiMenu,
    UiUser,
    TranslatePipe,
    ImpersonationDialog,
  ],
  template: `
    <div class="crm-shell" data-density="compact">
      @if (impersonationActive()) {
        <div class="crm-shell__impersonation" role="status">
          <app-ui-icon name="person" [size]="16" />
          <span>{{ impersonationBanner() }}</span>
          <button type="button" class="crm-shell__impersonation-action" (click)="stopImpersonation()">
            {{ 'nav.returnToAdmin' | translate }}
          </button>
        </div>
      }

      <header class="crm-shell__header">
        <div class="crm-shell__left">
          <a class="crm-shell__brand" routerLink="/crm/leads" aria-label="KOLSS CRM">
            <span class="crm-shell__brand-logo" aria-hidden="true">
              <svg
                class="crm-shell__brand-logo-svg"
                viewBox="0 0 100 16"
                xmlns="http://www.w3.org/2000/svg"
                focusable="false"
              >
                <defs>
                  <linearGradient id="kolssBrandGradient" x1="0" y1="0" x2="100" y2="0">
                    <stop offset="0%" stop-color="var(--ui-coral)" />
                    <stop offset="48%" stop-color="var(--ui-magenta)" />
                    <stop offset="100%" stop-color="var(--ui-violet)" />
                  </linearGradient>
                </defs>
                <mask
                  id="kolssMask"
                  style="mask-type:luminance"
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="100"
                  height="16"
                >
                  <path d="M100 0H0V15.0589H100V0Z" fill="white" />
                </mask>
                <g mask="url(#kolssMask)">
                  <path
                    d="M20.3945 0.132864C20.7363 0.0615984 21.8789 0.0884102 22.297 0.0888179L26.0028 0.0924199L30.6532 0.0887601C32.2618 0.0874322 33.4414 -0.116181 34.863 0.808729C37.2967 2.40877 37.1904 4.30095 37.2761 6.82741C37.3913 10.221 37.2793 13.7601 33.1661 14.6911C32.7027 14.8143 31.1248 14.7704 30.5639 14.7698L26.021 14.7647L22.7454 14.7705C22.1447 14.7721 21.4927 14.7919 20.8983 14.7487C19.0158 14.612 17.1446 12.9521 16.6607 11.1499C16.5786 10.8374 16.5257 10.5178 16.5028 10.1955C16.4508 9.43445 16.4997 8.15247 16.4958 7.35638C16.4919 6.56227 16.4367 4.88663 16.5466 4.16689C16.6278 3.61697 16.813 3.08761 17.0924 2.60723C17.8805 1.24164 18.8908 0.53527 20.3945 0.132864ZM32.5838 11.4721C33.6085 11.1704 34.0906 10.3055 34.0646 9.26401C34.0326 7.98074 34.0747 6.69227 34.0677 5.40845C33.9935 3.01643 32.3311 3.21002 30.6046 3.20954L27.1987 3.21044L23.3588 3.21273C22.7037 3.21284 21.8101 3.18812 21.1696 3.23087C20.6477 3.42763 20.0912 3.72053 19.8476 4.25614C19.7276 4.51999 19.6761 4.8367 19.6499 5.12341C19.5748 5.94353 19.5308 9.62314 19.7704 10.255C19.9776 10.8011 20.3604 11.1652 20.8881 11.4021C21.0785 11.4876 21.2583 11.5254 21.4665 11.5373C22.5746 11.6 32.1308 11.6212 32.5838 11.4721Z"
                    fill="url(#kolssBrandGradient)"
                  />
                  <path
                    d="M38.6126 0.136719C39.6065 0.166004 40.7427 0.137756 41.7479 0.137011L41.7494 7.35321C41.7486 8.4312 41.7172 9.59978 41.7721 10.6771C41.7837 10.906 41.9491 11.1564 42.0759 11.3423C42.7412 11.6476 44.044 11.552 44.8083 11.5521L48.3882 11.5522C51.7865 11.552 55.247 11.5851 58.641 11.5391C58.6313 12.6162 58.6322 13.6934 58.644 14.7705L42.9498 14.7686C40.2934 14.767 38.6315 13.3059 38.6094 10.568C38.6016 9.60305 38.6079 8.62111 38.6079 7.6546L38.6126 0.136719Z"
                    fill="url(#kolssBrandGradient)"
                  />
                  <path
                    d="M13.0721 0.146952C13.4279 0.115753 14.1654 0.138156 14.543 0.138165C15.4162 0.13081 16.2893 0.13649 17.1624 0.1552C16.7778 0.550664 14.9566 1.88827 14.4461 2.28187L10.4084 5.40414C9.43261 6.15507 8.37629 6.94136 7.435 7.72712C7.85273 7.94905 9.61568 9.38139 10.1224 9.77535L16.3653 14.6256C16.3795 14.645 16.3824 14.7011 16.3856 14.7281C16.137 14.822 13.1852 14.7681 12.7196 14.7667C10.9633 13.503 8.96343 11.832 7.23676 10.4842L4.90364 8.66533C4.51315 8.35951 3.9154 7.91847 3.57715 7.58029C3.949 7.22684 4.3748 6.94434 4.78067 6.63035C5.34085 6.19697 5.89901 5.76105 6.45619 5.32385L13.0721 0.146952Z"
                    fill="url(#kolssBrandGradient)"
                  />
                  <path
                    d="M46.3144 0.374307C46.5049 0.369026 46.7384 0.385337 46.9327 0.394271C47.1665 0.835267 47.9161 2.6264 48.0898 3.10551C48.4195 2.46395 48.9423 1.09245 49.2426 0.373047L49.8847 0.379048C49.8886 0.877629 49.9438 3.40593 49.8378 3.72656L49.7284 3.77378C49.683 3.75909 49.6137 3.74721 49.5795 3.71439C49.4028 3.54412 49.4858 1.71259 49.4745 1.35682C49.4896 1.26292 49.4785 1.21061 49.4658 1.11791C49.1205 1.31421 48.5824 3.7429 48.0885 3.74608C47.7096 3.54141 46.8866 1.36882 46.7132 0.865658C46.7104 1.79066 46.7099 2.7171 46.7158 3.64056C46.7158 3.64056 46.6551 3.71196 46.6489 3.71919C46.5341 3.73583 46.4438 3.76196 46.3456 3.70149C46.2434 3.40226 46.3133 0.888018 46.3144 0.374307Z"
                    fill="url(#kolssBrandGradient)"
                  />
                  <path
                    d="M43.9937 0.374232C44.3989 0.382206 45.6321 0.314863 45.9266 0.458005C45.9611 0.575017 45.9589 0.528281 45.931 0.650091C45.7887 0.694764 45.3445 0.683059 45.1725 0.683808L45.1743 3.08668C45.1777 3.25573 45.2092 3.61065 45.1183 3.73157C44.9768 3.74756 44.9465 3.75007 44.8124 3.70367C44.7253 3.45563 44.7775 1.10469 44.7794 0.679025C44.5444 0.674048 44.313 0.736919 44.095 0.664764C43.9752 0.556169 44.0104 0.573339 43.9937 0.374232Z"
                    fill="url(#kolssBrandGradient)"
                  />
                  <path
                    d="M84.4513 0H98.1838L98.1868 3.12605L89.3858 3.11894L86.7786 3.11919C86.2462 3.11928 85.7929 3.1152 85.2278 3.15333C84.5487 3.19917 83.0321 3.8581 83.8703 4.7273C84.5433 5.42534 85.9207 5.32429 86.8569 5.32345L92.3002 5.31558C94.7088 5.31187 97.1608 4.96454 98.9109 7.00384C99.5429 7.74041 99.7794 8.37889 100 9.3117V10.7373C99.9794 10.7965 99.9756 10.8553 99.9658 10.9171C99.6661 12.7147 98.1298 14.1993 96.3927 14.6315C95.6223 14.8232 94.6564 14.768 93.8509 14.7683L91.1008 14.7685L80.8174 14.7689L80.8167 11.5406C83.6626 11.6175 86.8204 11.5506 89.6869 11.5511L93.1474 11.5513C94.7202 11.5514 96.4931 11.9031 96.8696 9.93794C96.2543 8.17134 94.9378 8.51967 93.3642 8.52294L88.0152 8.52705C86.1466 8.5275 84.4133 8.71969 82.7119 7.81023C79.4066 6.04379 79.8462 1.63822 83.2299 0.335745C83.6512 0.173407 84.0231 0.118514 84.4513 0Z"
                    fill="url(#kolssBrandGradient)"
                  />
                  <path
                    d="M63.8404 0H77.5766C77.5705 1.04283 77.5751 2.08568 77.5888 3.12843C77.4579 3.12529 77.3279 3.12332 77.1971 3.12255L68.7178 3.11834L66.1827 3.11757C65.213 3.11792 64.0279 3.01591 63.2491 3.72336C62.9366 4.00724 62.9951 4.45172 63.2915 4.72601C64.0728 5.44896 65.1475 5.31959 66.1246 5.31735L71.5284 5.31514C73.9015 5.31387 76.289 4.94855 78.0938 6.78935C79.8392 8.56964 79.9107 11.5152 78.1052 13.2843C76.5232 14.8339 75.2984 14.7678 73.252 14.7685L70.5084 14.7686H60.2432L60.2422 11.5406C63.461 11.6279 66.7026 11.5492 69.9239 11.5491C70.9063 11.5491 74.209 11.6613 74.9249 11.4686C75.3814 11.3459 75.8292 11.0427 76.0677 10.6279C76.2038 10.3902 76.292 10.0924 76.2183 9.82013C76.0715 9.27801 75.6744 8.82419 75.1421 8.63945C74.4229 8.38992 73.4502 8.52461 72.689 8.52598L67.5249 8.52499C66.2999 8.52682 65.1743 8.5761 63.9371 8.42239C60.9639 8.0533 58.7168 5.05201 60.3789 2.20837C61.2408 0.734301 62.2935 0.412838 63.8404 0Z"
                    fill="url(#kolssBrandGradient)"
                  />
                  <path d="M0 0.136719L3.12095 0.141024L3.12486 14.7692L0 14.7668V0.136719Z" fill="url(#kolssBrandGradient)" />
                </g>
              </svg>
            </span>
          </a>

          <nav class="crm-shell__nav" [attr.aria-label]="'nav.main' | translate">
            <a routerLink="/crm/dashboard" routerLinkActive="is-active">
              <app-ui-icon name="dashboard" [size]="17" />
              {{ 'nav.dashboard' | translate }}
            </a>
            <a routerLink="/crm/leads" routerLinkActive="is-active">
              <app-ui-icon name="view_kanban" [size]="17" />
              {{ 'nav.leads' | translate }}
            </a>
            <a routerLink="/crm/reports" routerLinkActive="is-active">
              <app-ui-icon name="bar_chart" [size]="17" />
              {{ 'nav.reports' | translate }}
            </a>
            @if (canManageAccounts()) {
              <a routerLink="/crm/accounts" routerLinkActive="is-active">
                <app-ui-icon name="history" [size]="17" />
                {{ 'nav.accounts' | translate }}
              </a>
            }
          </nav>

          <div class="crm-shell__context-controls" [attr.aria-label]="'nav.crmControls' | translate">
            @if (showOfficeFilter()) {
              <div
                class="crm-shell__segmented crm-shell__segmented--office"
                [attr.aria-label]="'nav.officeContext' | translate"
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
          </div>
        </div>

        <div class="crm-shell__user" [attr.aria-label]="'nav.currentUser' | translate">
          <app-ui-user
            class="crm-shell__user-avatar"
            [userId]="userId()"
            [name]="displayName()"
            size="md"
            [showName]="false"
            [ariaLabel]="displayName()"
            [priority]="true"
          />
          <div class="crm-shell__user-meta">
            <span>{{ displayName() }}</span>
            <small>{{ roleName() }}</small>
          </div>
          <app-ui-menu [label]="'nav.menu' | translate" [items]="userMenuItems()" (selected)="handleUserMenu($event)" />
        </div>
      </header>

      <main class="crm-shell__main">
        <router-outlet />
      </main>

      @if (showImpersonationDialog()) {
        <app-impersonation-dialog
          (selected)="onImpersonationSelected($event)"
          (cancelled)="closeImpersonationDialog()"
        />
      }
    </div>
  `,
  styles: `
    .crm-shell {
      min-height: 100dvh;
      display: grid;
      grid-template-rows: auto auto 1fr;
      background: linear-gradient(180deg, var(--ui-surface-subtle), var(--ui-surface-canvas) 18rem);
    }

    .crm-shell:not(:has(.crm-shell__impersonation)) {
      grid-template-rows: auto 1fr;
    }

    .crm-shell__impersonation {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--ui-space-3);
      padding: var(--ui-space-2) var(--ui-space-6);
      background: color-mix(in srgb, var(--ui-warning) 16%, var(--ui-surface-raised));
      border-bottom: 1px solid color-mix(in srgb, var(--ui-warning) 28%, var(--ui-border));
      color: var(--ui-text);
      font-size: 0.8125rem;
      font-weight: 650;
    }

    .crm-shell__impersonation-action {
      margin-left: var(--ui-space-2);
      border: 0;
      background: transparent;
      color: var(--ui-action);
      font: inherit;
      font-weight: 700;
      text-decoration: underline;
      cursor: pointer;
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
      gap: var(--ui-space-2);
    }

    .crm-shell__brand {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-3);
      color: inherit;
      text-decoration: none;
      font-family: var(--ui-font-display), sans-serif;
      line-height: 1.1;
      flex: 0 0 auto;
    }

    .crm-shell__brand-logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 2.25rem;
      padding: 0;
      flex: 0 0 auto;
    }

    .crm-shell__brand-logo-svg {
      display: block;
      height: 2.1rem;
      width: auto;
      max-width: 8rem;
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

    .crm-shell__user-meta {
      display: grid;
      text-align: right;
      line-height: 1.2;
    }

    .crm-shell__user-avatar {
      display: inline-flex;
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
  private readonly impersonation = inject(ImpersonationService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly showImpersonationDialog = signal(false);

  protected readonly locales: readonly { value: LocaleCode; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'pl', label: 'Polski' },
    { value: 'uk', label: 'Українська' },
  ];

  protected readonly impersonationActive = this.impersonation.isActive;

  protected readonly impersonationBanner = computed(() =>
    this.i18n.t('impersonation.banner', { name: this.displayName() }),
  );

  protected readonly userMenuItems = computed<readonly UiMenuItem[]>(() => {
    const activeLocale = this.locale();
    const items: UiMenuItem[] = this.locales.map((item) => ({
      value: `locale:${item.value}`,
      label: item.label,
      icon: activeLocale === item.value ? 'check' : undefined,
    }));

    items.push({ value: 'design', label: this.i18n.t('nav.designSystem'), icon: 'view_kanban' });

    if (this.impersonation.isActive()) {
      items.push({
        value: 'stop-impersonation',
        label: this.i18n.t('nav.returnToAdmin'),
        icon: 'arrow_back',
      });
    } else if (isSuperAdminRole(this.auth.profile()?.role)) {
      items.push({
        value: 'login-as',
        label: this.i18n.t('nav.loginAs'),
        icon: 'person',
      });
    }

    items.push({ value: 'logout', label: this.i18n.t('common.logout'), icon: 'arrow_back' });
    return items;
  });

  readonly displayName = () =>
    this.auth.profile()?.display_name ?? this.auth.sessionContext()?.user.email ?? this.i18n.t('common.user');
  readonly userId = () => this.auth.profile()?.id ?? null;
  readonly roleName = () => this.i18n.roleLabel(this.auth.profile()?.role ?? 'office_member');
  readonly canManageAccounts = () => this.session.officeContext()?.isSuperAdmin ?? false;
  readonly showOfficeFilter = this.session.showOfficeFilter;
  readonly officeFilter = this.session.officeFilter;
  readonly locale = this.session.locale;

  protected readonly officeFilters = computed(() => {
    const offices = this.session.officeContext()?.filterOffices ?? [];
    const items: { value: OfficeFilter; label: string }[] = [
      { value: 'all', label: this.i18n.t('office.all') },
    ];
    for (const office of offices) {
      if (office.code === 'kyiv' || office.code === 'warsaw') {
        items.push({
          value: office.code,
          label: this.i18n.officeFilterLabel(office.code),
        });
      }
    }
    return items;
  });

  protected setOfficeFilter(filter: OfficeFilter): void {
    this.session.setOfficeFilter(filter);
  }

  protected async handleUserMenu(value: string): Promise<void> {
    if (value.startsWith('locale:')) {
      this.session.setLocale(value.slice('locale:'.length) as LocaleCode);
      return;
    }
    if (value === 'design') {
      await this.router.navigateByUrl('/design');
      return;
    }
    if (value === 'login-as') {
      this.showImpersonationDialog.set(true);
      return;
    }
    if (value === 'stop-impersonation') {
      this.stopImpersonation();
      return;
    }
    if (value === 'logout') {
      await this.signOut();
    }
  }

  protected closeImpersonationDialog(): void {
    this.showImpersonationDialog.set(false);
  }

  protected onImpersonationSelected(userId: string): void {
    this.impersonation.start(userId);
    this.showImpersonationDialog.set(false);
    globalThis.location.reload();
  }

  protected stopImpersonation(): void {
    this.impersonation.stop();
    globalThis.location.reload();
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
