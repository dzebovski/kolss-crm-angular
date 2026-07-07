import { Component, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { safeCrmReturnTo } from '../../../core/navigation/safe-return-to';
import { UiAlert } from '../../../ui/feedback/ui-alert';
import { UiButton } from '../../../ui/button/ui-button';
import { UiTextField } from '../../../ui/form/ui-text-field';

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, FormField, UiAlert, UiButton, UiTextField],
  template: `
    <main class="login-page">
      <section class="login-card" aria-labelledby="login-title">
        <p class="login-card__eyebrow">KOLSS CRM</p>
        <h1 id="login-title">Вхід до системи</h1>
        <p class="login-card__lead">Увійдіть за корпоративною поштою та паролем.</p>

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
            name="email"
            [required]="true"
            placeholder="name@kolss.com"
          />
          <app-ui-text-field
            [formField]="loginForm.password"
            label="Пароль"
            type="password"
            name="password"
            [required]="true"
          />
          <app-ui-button type="submit" variant="primary" [block]="true" [loading]="submitting()">
            Увійти
          </app-ui-button>
        </form>

        <a class="login-card__back" routerLink="/design">Дизайн-система</a>
      </section>
    </main>
  `,
  styles: `
    .login-page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: var(--ui-space-6);
      background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--ui-action) 12%, transparent), transparent 45%),
        var(--ui-surface-canvas);
    }

    .login-card {
      width: min(100%, 28rem);
      display: grid;
      gap: var(--ui-space-4);
      padding: var(--ui-space-6);
      border: 1px solid var(--ui-border-subtle);
      border-radius: var(--ui-radius-xl);
      background: var(--ui-surface-raised);
      box-shadow: var(--ui-shadow-2);
    }

    .login-card__eyebrow {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ui-ink-muted);
    }

    .login-card h1 {
      margin: 0;
      font-family: var(--ui-font-display);
      font-size: 1.75rem;
      line-height: 1.1;
    }

    .login-card__lead {
      margin: 0;
      color: var(--ui-ink-muted);
    }

    .login-form {
      display: grid;
      gap: var(--ui-space-4);
    }

    .login-card__back {
      color: var(--ui-ink-muted);
      font-size: 0.875rem;
      text-decoration: none;
    }

    .login-card__back:hover {
      color: var(--ui-action);
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(this.resolveInitialError());

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

    try {
      await this.auth.signIn(
        this.loginForm.email().value().trim(),
        this.loginForm.password().value(),
      );
      const next = safeCrmReturnTo(this.route.snapshot.queryParamMap.get('next'));
      await this.router.navigateByUrl(next);
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
