import { Component, input, output } from '@angular/core';

import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  V2_PROJECT_FILTER_ORDER,
  V2_PROJECT_STATUS_COLOR,
  v2ProjectStatusLabelKey,
} from '@domain/v2/project-status';
import type { V2ProjectFacets, V2ProjectStatus } from '@domain/v2/project.types';
import { V2FilterChip } from '../../ui/v2-filter-chip';
import { V2SearchField } from '../../ui/v2-search-field';
import { V2Select, type V2SelectOption } from '../../ui/v2-select';

export interface V2ProjectChip {
  readonly value: V2ProjectStatus;
  readonly labelKey: MessageKey;
  /** `null` until the counts arrive. */
  readonly count: number | null;
  readonly color: string;
  readonly selected: boolean;
}

/** Status chips in pipeline order, with the facet counts once they arrive. */
export function v2ProjectChips(
  facets: V2ProjectFacets | null,
  selected: readonly V2ProjectStatus[],
): readonly V2ProjectChip[] {
  return V2_PROJECT_FILTER_ORDER.map((value) => ({
    value,
    labelKey: v2ProjectStatusLabelKey(value),
    count: facets ? facets.status[value] : null,
    color: V2_PROJECT_STATUS_COLOR[value],
    selected: selected.includes(value),
  }));
}

/**
 * Manager select: "All managers", then the employees of the selected office (all offices when
 * none is selected) by name; the chosen manager stays even if they belong to another office.
 */
export function v2ManagerOptions(
  employees: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly officeUuids: readonly string[];
  }[],
  officeId: string | null,
  chosen: string,
  allLabel: string,
  locale: string,
): readonly V2SelectOption[] {
  return [
    { value: '', label: allLabel },
    ...employees
      .filter(
        (employee) =>
          employee.id === chosen || !officeId || employee.officeUuids.includes(officeId),
      )
      .map((employee) => ({ value: employee.id, label: employee.displayName }))
      .sort((a, b) => a.label.localeCompare(b.label, locale)),
  ];
}

// Filters card of the Projects-list board: search, manager select, Clear filters and the
// multi-select status chips with counts. Presentational: the page owns the state (query params).
@Component({
  selector: 'app-v2-projects-filters',
  imports: [TranslatePipe, V2FilterChip, V2SearchField, V2Select],
  templateUrl: './v2-projects-filters.html',
  styleUrl: './v2-projects-filters.scss',
})
export class V2ProjectsFilters {
  readonly search = input.required<string>();
  readonly manager = input.required<string>();
  /** The employees list is still loading: the select waits so it can show the chosen manager. */
  readonly managersLoading = input(false);
  readonly managerOptions = input.required<readonly V2SelectOption[]>();
  readonly statusChips = input.required<readonly V2ProjectChip[]>();
  /** The kanban has a column per stage, so it hides the status chips. */
  readonly showStatuses = input(true);
  readonly filtersActive = input.required<boolean>();

  readonly searchChange = output<string>();
  readonly managerChange = output<string>();
  readonly statusToggle = output<V2ProjectStatus>();
  readonly clear = output<void>();
}
