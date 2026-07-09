import { Component, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { safeCrmReturnTo } from '../../../core/navigation/safe-return-to';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiButton } from '../../../ui/button/ui-button';
import { UiCheckbox } from '../../../ui/form/ui-checkbox';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiIcon } from '../../../ui/icon/ui-icon';

const IMPERSONATE_AFTER_LOGIN_KEY = 'kolss_impersonate_after_login';

function readImpersonateAfterLogin(): boolean {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return false;
  return localStorage.getItem(IMPERSONATE_AFTER_LOGIN_KEY) === '1';
}

function writeImpersonateAfterLogin(value: boolean): void {
  if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return;
  localStorage.setItem(IMPERSONATE_AFTER_LOGIN_KEY, value ? '1' : '0');
}

function withImpersonateParam(url: string): string {
  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('impersonate', '1');
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, FormField, UiAlert, UiButton, UiCheckbox, UiIcon, UiTextField],
  template: `
    <main class="login-page">
      <section class="login-frame" aria-labelledby="login-title">
        <div class="login-panel login-panel--brand">
          <a class="login-brand" routerLink="/design" aria-label="KOLSS design system">
            <span class="login-brand__mark" aria-hidden="true"></span>
            <span>
              <strong>KOLSS</strong>
              <small>CRM workspace</small>
            </span>
          </a>

          <div class="login-copy">
            <p class="login-copy__eyebrow">Операційний доступ</p>
            <h1 id="login-title">Вхід до CRM</h1>
            <p>
              Використайте корпоративну пошту та пароль, щоб перейти до лідів, звітності й керування
              акаунтами.
            </p>
          </div>

          <div class="login-status" aria-label="Стан системи">
            <div>
              <app-ui-icon name="check_circle" [size]="18" [filled]="true" />
              <span>Auth</span>
              <strong>active</strong>
            </div>
            <div>
              <app-ui-icon name="view_kanban" [size]="18" />
              <span>UI prototype</span>
              <strong>mocks</strong>
            </div>
            <div>
              <app-ui-icon name="calendar_month" [size]="18" />
              <span>Offices</span>
              <strong>KY / WA</strong>
            </div>
          </div>
        </div>

        <div class="login-panel login-panel--form">
          <div class="login-form-heading">
            <span>Secure sign in</span>
            <h2>Пошта і пароль</h2>
          </div>

          @if (errorMessage()) {
            <app-ui-alert tone="danger" title="Не вдалося увійти">
              {{ errorMessage() }}
            </app-ui-alert>
          }

          <form class="login-form" (submit)="onSubmit($event)">
            <app-ui-text-field
              [formField]="loginForm.email"
              label="Email"
              type="email"
              placeholder="name@kolss.com"
            />
            <app-ui-text-field [formField]="loginForm.password" label="Пароль" type="password" />

            <app-ui-checkbox
              label="Після входу відкрити “Увійти як…” (лише для супер-адміна)"
              [(checked)]="impersonateAfterLogin"
            />

            <app-ui-button type="submit" variant="primary" [block]="true" [loading]="submitting()">
              Увійти
            </app-ui-button>
          </form>

          <a class="login-card__back" routerLink="/design">Відкрити дизайн-систему</a>
        </div>
      </section>
    </main>
  `,
  styles: `
    .login-page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: var(--ui-space-8);
      background:
        linear-gradient(
          90deg,
          color-mix(in srgb, var(--ui-action) 7%, transparent) 1px,
          transparent 1px
        ),
        linear-gradient(color-mix(in srgb, var(--ui-action) 6%, transparent) 1px, transparent 1px),
        var(--ui-surface-canvas);
      background-size: 44px 44px;
    }

    .login-frame {
      width: min(100%, 60rem);
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(24rem, 0.95fr);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-xl);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-2);
      overflow: hidden;
    }

    .login-panel {
      padding: var(--ui-space-8);
    }

    .login-panel--brand {
      min-height: 34rem;
      display: grid;
      align-content: space-between;
      gap: var(--ui-space-8);
      border-right: 1px solid var(--ui-border);
      background:
        linear-gradient(135deg, rgb(255 255 255 / 84%), rgb(255 255 255 / 58%)),
        var(--ui-surface-subtle);
    }

    .login-panel--form {
      display: grid;
      align-content: center;
      gap: var(--ui-space-5);
    }

    .login-brand {
      width: fit-content;
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-3);
      color: var(--ui-text);
      text-decoration: none;
    }

    .login-brand__mark {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: var(--ui-radius-lg);
      background:
        linear-gradient(135deg, rgb(255 255 255 / 72%), transparent 52%), var(--ui-brand-gradient);
      box-shadow: var(--ui-shadow-1);
    }

    .login-brand strong {
      display: block;
      font-family: var(--ui-font-display);
      font-size: 1.25rem;
      line-height: 1;
    }

    .login-brand small,
    .login-copy__eyebrow,
    .login-form-heading span {
      color: var(--ui-text-subtle);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .login-copy {
      max-width: 26rem;
    }

    .login-copy__eyebrow {
      margin: 0;
    }

    .login-copy h1,
    .login-form-heading h2 {
      font-family: var(--ui-font-display);
      line-height: 1.1;
    }

    .login-copy h1 {
      margin: var(--ui-space-3) 0;
      font-size: 3.5rem;
      letter-spacing: 0;
    }

    .login-copy p {
      margin: 0;
      color: var(--ui-text-muted);
      font-size: 1rem;
    }

    .login-status {
      display: grid;
      gap: var(--ui-space-2);
    }

    .login-status div {
      min-height: 2.75rem;
      padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-border);
      border-radius: var(--ui-radius-md);
      background: var(--ui-surface-raised);
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: var(--ui-space-3);
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .login-status app-ui-icon {
      color: var(--ui-action);
    }

    .login-status strong {
      color: var(--ui-text);
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .login-form-heading {
      display: grid;
      gap: var(--ui-space-2);
    }

    .login-form-heading h2 {
      margin: 0;
      font-size: 1.75rem;
    }

    .login-form {
      display: grid;
      gap: var(--ui-space-4);
    }

    .login-card__back {
      width: fit-content;
      color: var(--ui-text-muted);
      font-size: 0.875rem;
      text-decoration: none;
    }

    .login-card__back:hover {
      color: var(--ui-action);
    }

    @media (max-width: 52rem) {
      .login-frame {
        grid-template-columns: 1fr;
      }

      .login-panel--brand {
        min-height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--ui-border);
      }

      .login-copy h1 {
        font-size: 2.5rem;
      }
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(this.resolveInitialError());
  readonly impersonateAfterLogin = signal(readImpersonateAfterLogin());

  readonly formModel = signal({
    email: '',
    password: '',
  });

  readonly loginForm = form(this.formModel, (schema) => {
    required(schema.email, { message: 'Вкажіть email' });
    required(schema.password, { message: 'Вкажіть пароль' });
  });

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    this.errorMessage.set(null);
    this.submitting.set(true);
    writeImpersonateAfterLogin(this.impersonateAfterLogin());

    try {
      await this.auth.signIn(
        this.loginForm.email().value().trim(),
        this.loginForm.password().value(),
      );
      const next = safeCrmReturnTo(this.route.snapshot.queryParamMap.get('next'));
      const shouldPromptImpersonation =
        this.impersonateAfterLogin() && this.auth.profile()?.role === 'super_admin';
      await this.router.navigateByUrl(shouldPromptImpersonation ? withImpersonateParam(next) : next);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Помилка входу');
    } finally {
      this.submitting.set(false);
    }
  }

  private resolveInitialError(): string | null {
    const error = this.route.snapshot.queryParamMap.get('error');
    if (error === 'deactivated') {
      return 'Обліковий запис деактивовано. Зверніться до адміністратора.';
    }
    if (error === 'session') {
      return 'Не вдалося завантажити контекст офісу. Спробуйте ще раз.';
    }
    return null;
  }
}
