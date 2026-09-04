import { Component, inject, linkedSignal, resource, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { CurrencyRatesService } from '@services/currency-rates.service';
import { UiButton } from '@ui/button/ui-button';
import { UiAlert } from '@ui/feedback/ui-alert';
import { UiIcon } from '@ui/icon/ui-icon';
import { UiTextField } from '@ui/form/ui-text-field';

interface CurrencyRatesFormModel {
  readonly plnPerEur: string;
  readonly uahPerEur: string;
  readonly uahPerUsd: string;
}

@Component({
  selector: 'app-currency-settings-page',
  imports: [FormField, RouterLink, TranslatePipe, UiAlert, UiButton, UiIcon, UiTextField],
  templateUrl: './currency-settings-page.html',
  styleUrl: './currency-settings-page.scss',
})
export class CurrencySettingsPage {
  private readonly ratesService = inject(CurrencyRatesService);
  protected readonly i18n = inject(I18nService);

  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly ratesResource = resource({ loader: () => this.ratesService.load() });
  protected readonly model = linkedSignal<CurrencyRatesFormModel>(() => {
    const rates = this.ratesResource.value();
    return {
      plnPerEur: rates ? String(rates.plnPerEur) : '',
      uahPerEur: rates ? String(rates.uahPerEur) : '',
      uahPerUsd: rates ? String(rates.uahPerUsd) : '',
    };
  });
  protected readonly ratesForm = form(this.model, (path) => {
    validate(path.plnPerEur, ({ value }) => this.rateError(value()));
    validate(path.uahPerEur, ({ value }) => this.rateError(value()));
    validate(path.uahPerUsd, ({ value }) => this.rateError(value()));
  });

  protected loadError(): string {
    const error = this.ratesResource.error();
    return error ? this.i18n.t('accounts.settings.loadError') : '';
  }

  protected updatedAtLabel(): string {
    const effectiveFrom = this.ratesResource.value()?.effectiveFrom;
    return effectiveFrom
      ? this.i18n.t('accounts.settings.updatedAt', {
          date: this.i18n.formatDateTime(effectiveFrom),
        })
      : '';
  }

  protected fieldError(field: typeof this.ratesForm.plnPerEur): string {
    const state = field();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.error.set('');
    this.notice.set('');
    const current = this.ratesResource.value();
    if (!current) return;

    void submit(this.ratesForm, async () => {
      const values = this.model();
      try {
        const updated = await this.ratesService.update(current.version, {
          plnPerEur: this.parseRate(values.plnPerEur),
          uahPerEur: this.parseRate(values.uahPerEur),
          uahPerUsd: this.parseRate(values.uahPerUsd),
        });
        this.ratesResource.value.set(updated);
        this.notice.set(this.i18n.t('accounts.settings.saved'));
      } catch (error) {
        if (error instanceof KolssApiError && error.code === 'version_conflict') {
          this.ratesResource.reload();
          this.error.set(this.i18n.t('accounts.settings.stale'));
          return;
        }
        this.error.set(this.i18n.t('accounts.settings.saveError'));
      }
    });
  }

  private rateError(
    value: string,
  ): { readonly kind: string; readonly message: string } | undefined {
    return this.parseRate(value) > 0
      ? undefined
      : { kind: 'rate', message: this.i18n.t('accounts.settings.invalid') };
  }

  private parseRate(value: string): number {
    return Number(value.trim().replace(/\s/g, '').replace(',', '.'));
  }
}
