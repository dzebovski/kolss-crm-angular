import { Component, computed, inject, input, output } from '@angular/core';

import type { HrCalendar, HrEmployee } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  hrCellKey,
  hrCellView,
  type HrCellView,
  indexHrCells,
  indexHrDays,
} from '@domain/hr/hr-calendar';
import { dateRange, isoWeekday } from '@domain/hr/hr-dates';
import { hrName } from '@domain/hr/hr-entry';
import { HrText } from '../hr-text';
import { HrAvatar } from '../ui/hr-avatar';
import { HrDayCell } from '../ui/hr-day-cell';
import type { HrDayPick } from './hr-grid.types';

interface HrGridRow {
  readonly employee: HrEmployee;
  readonly name: string;
  readonly schedule: string;
  readonly cells: readonly { readonly view: HrCellView; readonly label: string }[];
}

/**
 * Month grid (HR-calendar-month.dc.html): "N people" header with day heads (weekday letter +
 * date; weekend / holiday / today), one row per person with 44px day cells, and the
 * "In office" footer ("–" when closed, a red dot and 0 when nobody is in).
 */
@Component({
  selector: 'app-hr-month-grid',
  imports: [HrAvatar, HrDayCell, TranslatePipe],
  templateUrl: './hr-month-grid.html',
  styleUrl: './hr-month-grid.scss',
})
export class HrMonthGrid {
  private readonly text = inject(HrText);

  readonly calendar = input.required<HrCalendar>();
  readonly selected = input<{ employeeId: string; date: string } | null>(null);

  readonly pick = output<HrDayPick>();

  protected readonly dates = computed(() => dateRange(this.calendar().from, this.calendar().to));

  private readonly dayIndex = computed(() => indexHrDays(this.calendar().days));

  protected readonly heads = computed(() => {
    const days = this.dayIndex();
    const today = this.calendar().today;
    const open = new Set(
      this.calendar()
        .office.hours.filter((h) => h.opens && h.closes)
        .map((h) => h.weekday),
    );
    return this.dates().map((date) => {
      const day = days.get(date);
      return {
        date,
        letter: this.text.weekdayLetter(date),
        number: this.text.dayNumber(date),
        weekend: !open.has(isoWeekday(date)),
        holiday: !!day?.holidayKind,
        holidayName: day?.holidayName ?? null,
        today: date === today,
        label: this.text.fullDay(date),
      };
    });
  });

  protected readonly rows = computed<HrGridRow[]>(() => {
    const calendar = this.calendar();
    const cells = indexHrCells(calendar.cells);
    const days = this.dayIndex();
    return calendar.people.map((employee) => {
      const name = hrName(employee);
      return {
        employee,
        name,
        schedule: this.text.schedule(employee.pattern),
        cells: this.dates().map((date) => {
          const view = hrCellView(
            date,
            cells.get(hrCellKey(employee.id, date)),
            days.get(date),
            employee,
            calendar.today,
          );
          return {
            view,
            label: this.text.t('hr.calendar.cellAria', {
              name,
              date: this.text.day(date),
              state: this.stateText(view),
            }),
          };
        }),
      };
    });
  });

  protected readonly footer = computed(() => {
    const days = this.dayIndex();
    return this.dates().map((date) => {
      const day = days.get(date);
      const closed = !day || !day.isOpen || !!day.holidayKind;
      return { date, closed, nobody: !closed && day.nobodyIn, count: day?.inOffice ?? 0 };
    });
  });

  protected readonly peopleLabel = computed(() =>
    this.text.plural('hr.n.people', this.calendar().people.length),
  );

  private stateText(view: HrCellView): string {
    switch (view.kind) {
      case 'closed':
        return this.text.t('hr.calendar.officeClosed');
      case 'absence':
        return view.half
          ? `${this.text.type(view.absence!.type)} · ${this.text.part(view.half)}`
          : this.text.type(view.absence!.type);
      case 'hours':
        return `${this.text.range(view.start, view.end)} · ${this.text.hours(view.minutes)}`;
      default:
        return this.text.t('hr.calendar.notWorking');
    }
  }

  protected isSelected(employeeId: string, date: string): boolean {
    const selected = this.selected();
    return !!selected && selected.employeeId === employeeId && selected.date === date;
  }

  protected onPick(employee: HrEmployee, date: string, event: Event): void {
    this.pick.emit({ employee, date, anchor: event.currentTarget as Element });
  }
}
