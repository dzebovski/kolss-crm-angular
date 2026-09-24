import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Budget } from '@domain/v2/lead-card.mapper';
import type { V2LeadCard } from '@domain/v2/lead-card.types';
import { V2_PRODUCT_LABEL } from '../../ui/v2-lead-labels';
import { V2Button } from '../../ui/v2-button';
import { V2CodeChip } from '../../ui/v2-code-chip';
import { V2RatingPill } from '../../ui/v2-rating-pill';
import { V2StatusPill } from '../../ui/v2-status-pill';

// Header card from lead card v1.3: avatar, LEAD eyebrow, name, rating / status / code pills,
// Create project + Edit contact info, then the Phone · E-mail · Location / Estimated budget /
// Product / Manager grid. Presentational: the page loads the lead and opens the popup.
@Component({
  selector: 'app-v2-lead-card-header',
  imports: [TranslatePipe, V2Button, V2CodeChip, V2RatingPill, V2StatusPill],
  templateUrl: './v2-lead-card-header.html',
  styleUrl: './v2-lead-card-header.scss',
})
export class V2LeadCardHeader {
  private readonly i18n = inject(I18nService);

  readonly card = input.required<V2LeadCard>();
  /** Null when the lead has no manager or the name isn't known. */
  readonly managerName = input<string | null>(null);
  readonly canEdit = input(false);
  readonly editContact = output<void>();

  protected readonly productLabels = V2_PRODUCT_LABEL;

  protected readonly budgetText = computed(() => {
    const budget = this.card().budget;
    return budget ? formatV2Budget(budget, this.i18n.locale()) : null;
  });
}
