import { Component, computed, inject, resource, signal } from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { SessionService } from '@core/session/session.service';
import { UiButton } from '@ui/button/ui-button';
import { UiAlert } from '@ui/feedback/ui-alert';
import { UiIcon } from '@ui/icon/ui-icon';
import { UiTextField } from '@ui/form/ui-text-field';
import { SalesFunnelService } from './sales-funnel.service';

type FunnelPeriodMode = 'week' | 'month' | 'custom';

interface FunnelDateModel {
  readonly from: string;
  readonly to: string;
}

@Component({
  selector: 'app-sales-funnel-page',
  imports: [FormField, RouterLink, TranslatePipe, UiAlert, UiButton, UiIcon, UiTextField],
  templateUrl: './sales-funnel-page.html',
  styleUrl: './sales-funnel-page.scss',
})
export class SalesFunnelPage {
  private readonly session = inject(SessionService);
  private readonly funnel = inject(SalesFunnelService);
  protected readonly i18n = inject(I18nService);

  private readonly initialPeriod = this.rollingPeriod(7);
  protected readonly periodMode = signal<FunnelPeriodMode>('week');
  protected readonly dateModel = signal<FunnelDateModel>(this.initialPeriod);
  protected readonly dateForm = form(this.dateModel, (path) => {
    validate(path.from, ({ value }) =>
      value()
        ? undefined
        : { kind: 'required', message: this.i18n.t('reports.validation.rangeRequired') },
    );
    validate(path.to, ({ value, valueOf }) => {
      if (!value()) {
        return { kind: 'required', message: this.i18n.t('reports.validation.rangeRequired') };
      }
      return valueOf(path.from) > value()
        ? { kind: 'order', message: this.i18n.t('reports.validation.rangeOrder') }
        : undefined;
    });
  });
  private readonly appliedPeriod = signal<FunnelDateModel>(this.initialPeriod);

  protected readonly reportResource = resource({
    params: () => ({
      officeId: this.session.selectedOfficeId(),
      ...this.appliedPeriod(),
    }),
    loader: ({ params }) => this.funnel.load(params),
  });

  protected readonly loadError = computed(() => {
    const error = this.reportResource.error();
    return error instanceof Error
      ? this.i18n.localizeError(error.message)
      : error
        ? String(error)
        : '';
  });

  protected readonly periodLabel = computed(() => {
    this.i18n.locale();
    const period = this.appliedPeriod();
    return `${this.i18n.formatDate(`${period.from}T12:00:00`)} — ${this.i18n.formatDate(`${period.to}T12:00:00`)}`;
  });

  protected selectPreset(mode: Exclude<FunnelPeriodMode, 'custom'>, days: number): void {
    const period = this.rollingPeriod(days);
    this.periodMode.set(mode);
    this.dateModel.set(period);
    this.appliedPeriod.set(period);
  }

  protected selectCustom(): void {
    this.periodMode.set('custom');
    this.dateModel.set(this.appliedPeriod());
  }

  protected applyCustomPeriod(event: Event): void {
    event.preventDefault();
    void submit(this.dateForm, async () => {
      this.appliedPeriod.set({ ...this.dateModel() });
    });
  }

  protected fieldError(field: typeof this.dateForm.from): string {
    const state = field();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected formatMoney(total: number, currency: string): string {
    return this.i18n.formatMoney(total, currency);
  }

  private rollingPeriod(days: number): FunnelDateModel {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    return { from: this.dateKey(from), to: this.dateKey(to) };
  }

  private dateKey(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
