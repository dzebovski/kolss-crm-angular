import { Component, input, output } from '@angular/core';

import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2LeadPeriod } from '@domain/v2/lead-list.rules';
import type { V2LeadRating, V2LeadStatus } from '@domain/v2/lead-view.types';
import { V2FilterChip } from '../../ui/v2-filter-chip';
import { V2SearchField } from '../../ui/v2-search-field';
import { V2SegmentedControl, type V2SegmentOption } from '../../ui/v2-segmented-control';

export interface V2LeadChip<T> {
  readonly value: T;
  readonly labelKey: MessageKey;
  readonly count: number | null;
  readonly selected: boolean;
}

// Filters card from the "KOLSS CRM v2" canvas (Main.dc.html, Filters): search, period presets
// with the date range, status chips with counts, rating chips, Clear filters. Presentational:
// the page owns the state (query params).
@Component({
  selector: 'app-v2-leads-filters',
  imports: [TranslatePipe, V2FilterChip, V2SearchField, V2SegmentedControl],
  templateUrl: './v2-leads-filters.html',
  styleUrl: './v2-leads-filters.scss',
})
export class V2LeadsFilters {
  readonly search = input.required<string>();
  readonly period = input.required<V2LeadPeriod>();
  readonly periodOptions = input.required<readonly V2SegmentOption<V2LeadPeriod>[]>();
  readonly rangeLabel = input.required<string>();
  readonly statusChips = input.required<readonly V2LeadChip<V2LeadStatus>[]>();
  readonly ratingChips = input.required<readonly V2LeadChip<V2LeadRating>[]>();
  readonly filtersActive = input.required<boolean>();

  readonly searchChange = output<string>();
  readonly periodChange = output<V2LeadPeriod>();
  readonly statusToggle = output<V2LeadStatus>();
  readonly ratingToggle = output<V2LeadRating>();
  readonly clear = output<void>();
}
