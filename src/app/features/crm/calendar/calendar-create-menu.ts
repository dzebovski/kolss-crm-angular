import { GridCellWidget } from '@angular/aria/grid';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Component, inject, input, output } from '@angular/core';

import type { AppointmentKind } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import { UiIcon } from '@ui/icon/ui-icon';

@Component({
  selector: 'app-calendar-create-menu',
  imports: [GridCellWidget, Menu, MenuContent, MenuItem, MenuTrigger, UiIcon],
  templateUrl: './calendar-create-menu.html',
  styleUrl: './calendar-create-menu.scss',
  host: {
    '[class.is-week]': 'variant() === "week"',
    '[class.is-month]': 'variant() === "month"',
  },
})
export class CalendarCreateMenu {
  protected readonly i18n = inject(I18nService);

  readonly variant = input.required<'week' | 'month'>();
  readonly triggerLabel = input('');
  readonly kindSelected = output<AppointmentKind>();

  protected selectKind(value: unknown): void {
    if (value === 'showroom' || value === 'measurement' || value === 'office_work') {
      this.kindSelected.emit(value);
    }
  }
}
