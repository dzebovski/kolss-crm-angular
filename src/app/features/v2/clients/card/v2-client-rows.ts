import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2ClientLeadRow, V2ClientProjectRow } from '@domain/v2/client.types';
import { formatV2CardDate } from '@domain/v2/date-format';
import type { V2LeadProduct } from '@domain/v2/lead-card.types';
import { formatV2Money } from '@domain/v2/project-money';
import { V2StatusPill } from '../../ui/v2-status-pill';
import { V2ProjectStatusPill } from '../../ui/v2-project-status-pill';
import { V2_PRODUCT_LABEL } from '../../ui/v2-lead-labels';

// Leads and Projects tables of the client card (Client-card.dc.html). Whole rows link to the lead
// card / project card. Presentational.
@Component({
  selector: 'app-v2-client-leads-table',
  imports: [RouterLink, TranslatePipe, V2StatusPill],
  template: `
    <div class="v2-rows__row v2-rows__row--leads v2-rows__head">
      <span>{{ 'v2.client.leads.created' | translate }}</span>
      <span>{{ 'v2.client.leads.status' | translate }}</span>
      <span>{{ 'v2.client.leads.product' | translate }}</span>
      <span>{{ 'v2.client.leads.manager' | translate }}</span>
      <span>{{ 'v2.client.leads.activity' | translate }}</span>
      <span></span>
    </div>
    @for (row of rows(); track row.lead.id) {
      <a
        class="v2-rows__row v2-rows__row--leads v2-rows__item"
        [routerLink]="['/v2/leads', row.lead.id]"
      >
        <span class="v2-rows__strong">{{ row.created }}</span>
        <span><app-v2-status-pill [status]="row.lead.status" size="sm" /></span>
        <span>{{ row.products }}</span>
        <span class="v2-rows__manager">{{ row.lead.managerName ?? '—' }}</span>
        <!-- TODO(v2): the API has no last comment on a client's lead row; shows the lead code. -->
        <span class="v2-rows__muted">{{ row.lead.code }}</span>
        <svg class="v2-rows__chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </a>
    }
  `,
  styleUrl: './v2-client-rows.scss',
})
export class V2ClientLeadsTable {
  private readonly i18n = inject(I18nService);
  readonly leads = input.required<readonly V2ClientLeadRow[]>();
  readonly now = input.required<Date>();

  protected readonly rows = computed(() => {
    this.i18n.locale();
    return this.leads().map((lead) => ({
      lead,
      created: formatV2CardDate(lead.createdAt, this.now(), this.i18n.locale()),
      products: productsLabel(lead.products, this.i18n),
    }));
  });
}

@Component({
  selector: 'app-v2-client-projects-table',
  imports: [RouterLink, TranslatePipe, V2ProjectStatusPill],
  template: `
    <div class="v2-rows__row v2-rows__row--projects v2-rows__head">
      <span>{{ 'v2.client.projects.project' | translate }}</span>
      <span>{{ 'v2.client.projects.status' | translate }}</span>
      <span>{{ 'v2.client.projects.nextEvent' | translate }}</span>
      <span>{{ 'v2.client.projects.manager' | translate }}</span>
      <span>{{ 'v2.client.projects.contract' | translate }}</span>
      <span></span>
    </div>
    @for (row of rows(); track row.project.id) {
      <a
        class="v2-rows__row v2-rows__row--projects v2-rows__item"
        [routerLink]="['/v2/projects', row.project.id]"
      >
        <span class="v2-rows__stack">
          <span class="v2-rows__title">{{ row.title }}</span>
          <span class="v2-rows__sub">{{ row.subtitle }}</span>
        </span>
        <span><app-v2-project-status-pill [status]="row.project.status" /></span>
        <!-- TODO(v2): the API has no next event on a client's project row. -->
        <span class="v2-rows__muted">—</span>
        <span class="v2-rows__manager">{{ row.project.managerName ?? '—' }}</span>
        <span class="v2-rows__stack">
          @if (row.project.contract; as contract) {
            <span class="v2-rows__strong">{{ row.total }}</span>
            <span class="v2-rows__sub v2-rows__sub--paid">{{ row.paid }}</span>
          } @else {
            <span class="v2-rows__muted">{{ 'v2.client.projects.noContract' | translate }}</span>
          }
        </span>
        <svg class="v2-rows__chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </a>
    }
  `,
  styleUrl: './v2-client-rows.scss',
})
export class V2ClientProjectsTable {
  private readonly i18n = inject(I18nService);
  readonly projects = input.required<readonly V2ClientProjectRow[]>();
  readonly now = input.required<Date>();

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    return this.projects().map((project) => ({
      project,
      title: productsLabel(project.products, this.i18n) || project.leadCode,
      subtitle: this.i18n.t('v2.client.projects.created', {
        date: formatV2CardDate(project.createdAt, this.now(), locale),
        code: project.leadCode,
      }),
      total: project.contract ? formatV2Money(project.contract.total, locale) : '',
      paid: project.contract
        ? this.i18n.t('v2.client.projects.paid', { percent: project.contract.percentPaid })
        : '',
    }));
  });
}

function productsLabel(products: readonly V2LeadProduct[], i18n: I18nService): string {
  return (
    products.map((product) => i18n.t(V2_PRODUCT_LABEL[product] as MessageKey)).join(', ') || '—'
  );
}
