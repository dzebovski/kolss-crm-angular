import { Component } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { HR_LEGEND_TYPES } from '@domain/hr/hr-entry';
import { HrAbsenceChip } from './hr-absence-chip';

/** Calendar legend (HR-components.dc.html, Legend): the types, then the day markers. */
@Component({
  selector: 'app-hr-legend',
  imports: [HrAbsenceChip, TranslatePipe],
  template: `
    <ul class="hr-legend" role="list">
      @for (type of types; track type) {
        <li><app-hr-absence-chip [type]="type" /></li>
      }
      <li class="hr-legend__mark">
        <span class="hr-legend__swatch hr-legend__swatch--holiday" aria-hidden="true"></span>
        {{ 'hr.legend.holiday' | translate }}
      </li>
      <li class="hr-legend__mark">
        <span class="hr-legend__swatch hr-legend__swatch--weekend" aria-hidden="true"></span>
        {{ 'hr.legend.weekend' | translate }}
      </li>
      <li class="hr-legend__mark">
        <span class="hr-legend__swatch hr-legend__swatch--today" aria-hidden="true"></span>
        {{ 'hr.legend.today' | translate }}
      </li>
      <li class="hr-legend__mark">
        <span class="hr-legend__dot" aria-hidden="true"></span>
        {{ 'hr.legend.nobodyIn' | translate }}
      </li>
    </ul>
  `,
  styles: `
    .hr-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .hr-legend__mark {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--v2-ink-2);
      font-size: 12px;
    }

    .hr-legend__swatch {
      width: 14px;
      height: 14px;
      border-radius: 4px;
      border: 1px solid var(--v2-line);
    }

    .hr-legend__swatch--holiday {
      background: var(--v2-surface-sunk);
      border-color: transparent;
    }

    .hr-legend__swatch--weekend {
      background: var(--v2-ground);
    }

    .hr-legend__swatch--today {
      border: 2px solid var(--v2-ink);
    }

    .hr-legend__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--v2-danger);
    }
  `,
})
export class HrLegend {
  protected readonly types = HR_LEGEND_TYPES;
}
