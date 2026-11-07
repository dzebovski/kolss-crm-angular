import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate } from '@domain/v2/date-format';
import { formatV2Budget } from '@domain/v2/lead-card.mapper';
import type { V2LeadCard, V2LeadColumns } from '@domain/v2/lead-card.types';
import type { V2ProjectType } from '@domain/v2/project.types';
import { V2Button } from '../../ui/v2-button';
import { V2_CHANNEL_LABEL, V2_PRODUCT_LABEL } from '../../ui/v2-lead-labels';

interface DetailField {
  readonly labelKey: MessageKey;
  readonly value: string | null;
  readonly sub: string | null;
}

interface ChecklistItem {
  readonly labelKey: MessageKey;
  readonly done: boolean;
}

const PROJECT_TYPE_LABEL: Record<V2ProjectType, MessageKey> = {
  express: 'v2.leadInfo.projectExpress',
  measure: 'v2.leadInfo.projectMeasure',
  contract: 'v2.leadInfo.projectContract',
};

// "Project details · collected on the lead" and the clarification checklist. The project copies
// nothing: the page loads the lead (`V2LeadCardService`) and passes it in. Edit details stays
// disabled until the API can patch the lead through the project (Q-P12).
@Component({
  selector: 'app-v2-project-details-card',
  imports: [TranslatePipe, V2Button],
  templateUrl: './v2-project-details-card.html',
  styleUrl: './v2-project-details-card.scss',
})
export class V2ProjectDetailsCard {
  private readonly i18n = inject(I18nService);

  /** Null while the lead loads or failed. */
  readonly card = input<V2LeadCard | null>(null);
  readonly columns = input<V2LeadColumns | null>(null);
  /** The project's own type wins over the lead's. */
  readonly projectType = input<V2ProjectType | null>(null);
  readonly now = input.required<Date>();
  readonly loading = input(false);
  readonly loadError = input(false);
  readonly retry = output<void>();

  protected readonly fields = computed<readonly DetailField[]>(() => {
    const card = this.card();
    const columns = this.columns();
    if (!card || !columns) return [];
    const locale = this.i18n.locale();
    const products = card.products.length
      ? card.products.map((product) => this.i18n.t(V2_PRODUCT_LABEL[product])).join(', ')
      : card.productText;
    const type = this.projectType() ?? columns.projectType;
    return [
      { labelKey: 'v2.card.product', value: products, sub: null },
      {
        labelKey: 'v2.projectCard.budget',
        value: card.budget ? formatV2Budget(card.budget, locale) : null,
        sub: null,
      },
      { labelKey: 'v2.card.location', value: card.location, sub: null },
      {
        labelKey: 'v2.projectCard.projectType',
        value: type ? this.i18n.t(PROJECT_TYPE_LABEL[type]) : null,
        sub: null,
      },
      {
        labelKey: 'v2.projectCard.materials',
        value: [columns.materialFronts, columns.materialWorktop].filter(Boolean).join(', ') || null,
        sub: null,
      },
      { labelKey: 'v2.projectCard.production', value: columns.expectedLeadTime, sub: null },
      { labelKey: 'v2.projectCard.appliances', value: columns.materialAppliances, sub: null },
      {
        labelKey: 'v2.projectCard.source',
        value: this.i18n.t(V2_CHANNEL_LABEL[card.channel]),
        sub: this.i18n.t('v2.projectCard.leadCreated', {
          date: formatV2CardDate(card.createdAt, this.now(), locale),
        }),
      },
    ];
  });

  protected readonly about = computed(() => this.columns()?.aboutClient ?? null);

  protected readonly checklist = computed<readonly ChecklistItem[]>(() => {
    const columns = this.columns();
    if (!columns) return [];
    return [
      { labelKey: 'v2.popup.success.checklistBudget', done: columns.checklistBudget === true },
      { labelKey: 'v2.popup.success.checklistLocation', done: columns.checklistLocation === true },
      { labelKey: 'v2.popup.success.checklistPeriod', done: columns.checklistPeriod === true },
      {
        labelKey: 'v2.popup.success.checklistMaterials',
        done: columns.checklistMaterials === true,
      },
      { labelKey: 'v2.popup.success.checklistProduct', done: columns.checklistProduct === true },
      { labelKey: 'v2.popup.success.clientInformed', done: columns.clientInformed === true },
    ];
  });
}
