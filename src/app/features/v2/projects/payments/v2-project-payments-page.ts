import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate } from '@domain/v2/date-format';
import { v2ProjectDay } from '@domain/v2/project-card';
import { formatV2Money, v2PaymentsNewestFirst, v2ProjectBalance } from '@domain/v2/project-money';
import { v2ProjectActions } from '@domain/v2/project-status';
import type { V2ProjectPayment } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2_NOW } from '../../core/v2-clock';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2ProjectCardActions } from '../card/v2-project-card-actions';
import { V2_PAYMENT_BASIS_LABEL } from '../dialogs/v2-project-payment-labels';

interface PaymentRow {
  readonly payment: V2ProjectPayment;
  readonly day: string;
  readonly amount: string;
  readonly basisKey: (typeof V2_PAYMENT_BASIS_LABEL)[keyof typeof V2_PAYMENT_BASIS_LABEL];
}

// Payments of one project (`/v2/projects/:projectId/payments`, P10; owner decisions 2026-11-14,
// no board — design-system style): estimate, paid totals and the remaining amount, then every
// payment (day, amount, basis, note, receipt, who added it) with Edit / Delete. The popups and
// the delete confirm are the project card's (`V2ProjectCardActions`).
@Component({
  selector: 'app-v2-project-payments-page',
  imports: [RouterLink, TranslatePipe, V2Button, V2CodeChip],
  providers: [V2ProjectCardActions],
  templateUrl: './v2-project-payments-page.html',
  styleUrl: './v2-project-payments-page.scss',
})
export class V2ProjectPaymentsPage {
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(V2_NOW);
  protected readonly act = inject(V2ProjectCardActions);

  /** Route parameter `:projectId`, bound through `withComponentInputBinding()`. */
  readonly projectId = input.required<string>();

  private readonly projectResource = resource({
    params: () => this.projectId(),
    loader: async ({ params }) => {
      try {
        return await this.projects.get(params);
      } catch (error) {
        if (error instanceof KolssApiError && (error.status === 404 || error.status === 403)) {
          return null;
        }
        throw error;
      }
    },
  });

  protected readonly project = computed(() =>
    this.projectResource.hasValue() ? this.projectResource.value() : null,
  );
  protected readonly loading = computed(
    () => this.projectResource.isLoading() && !this.projectResource.hasValue(),
  );
  protected readonly notFound = computed(
    () => this.projectResource.hasValue() && this.projectResource.value() === null,
  );
  protected readonly loadFailed = computed(() => this.projectResource.status() === 'error');

  protected readonly canPay = computed(() => {
    const project = this.project();
    return project ? v2ProjectActions(project).canAddPayment : false;
  });

  private readonly now = computed(() => {
    this.projectResource.status();
    return this.clock();
  });

  protected readonly estimate = computed(() => {
    const estimate = this.project()?.estimate;
    return estimate ? formatV2Money(estimate, this.i18n.locale()) : null;
  });
  protected readonly paid = computed(() => {
    const locale = this.i18n.locale();
    const totals = (this.project()?.paidTotals ?? []).map((money) => formatV2Money(money, locale));
    return totals.length ? totals.join(' + ') : null;
  });
  protected readonly balance = computed(() => {
    const project = this.project();
    const balance = project && v2ProjectBalance(project.estimate, project.paidTotals);
    if (!balance) return null;
    const overpaid = balance.remaining.amount < 0;
    return {
      overpaid,
      text: formatV2Money(
        { ...balance.remaining, amount: Math.abs(balance.remaining.amount) },
        this.i18n.locale(),
      ),
      otherCurrencies: balance.otherCurrencies,
    };
  });

  protected readonly rows = computed<readonly PaymentRow[]>(() => {
    const locale = this.i18n.locale();
    const now = this.now();
    return v2PaymentsNewestFirst(this.project()?.payments ?? []).map((payment) => ({
      payment,
      day: formatV2CardDate(v2ProjectDay(payment.paidOn), now, locale),
      amount: formatV2Money(payment.amount, locale),
      basisKey: V2_PAYMENT_BASIS_LABEL[payment.basis],
    }));
  });

  protected retry(): void {
    this.projectResource.reload();
  }

  constructor() {
    this.act.connect(this.project, (project) => this.projectResource.set(project));
  }
}
