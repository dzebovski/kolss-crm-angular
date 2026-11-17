import { Component, computed, inject, input, output } from '@angular/core';

import type { HrCalendar, HrEmployee } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  hrCellKey,
  hrCellView,
  type HrCellView,
  hrDayCoverage,
  hrOfficeHoursOn,
  indexHrCells,
  indexHrDays,
} from '@domain/hr/hr-calendar';
import { dateRange, hoursLabel } from '@domain/hr/hr-dates';
import { hrName } from '@domain/hr/hr-entry';
import { HrText } from '../hr-text';
import { HrAbsenceChip } from '../ui/hr-absence-chip';
import { HrAvatar } from '../ui/hr-avatar';
import { HrHourBar } from '../ui/hr-hour-bar';
import type { HrDayPick } from './hr-grid.types';

/**
 * Week view (HR-calendar-week.dc.html): a column per day with its office hours; each cell the
 * planned bar on that day's track with `10–14` and `4 h`, a full-day absence chip, or
 * "Not working" / "Office closed"; footer "Hours covered X of Y h" (remote does not count).
 */
@Component({
  selector: 'app-hr-week-grid',
  imports: [HrAbsenceChip, HrAvatar, HrHourBar, TranslatePipe],
  templateUrl: './hr-week-grid.html',
  styleUrl: './hr-week-grid.scss',
})
export class HrWeekGrid {
  private readonly text = inject(HrText);

  readonly calendar = input.required<HrCalendar>();
  readonly pick = output<HrDayPick>();

  protected readonly columns = computed(() => {
    const calendar = this.calendar();
    const days = indexHrDays(calendar.days);
    return dateRange(calendar.from, calendar.to).map((date) => {
      const hours = hrOfficeHoursOn(calendar.office, date);
      const day = days.get(date);
      const closed = !hours || !!day?.holidayKind;
      const coverage = closed ? null : hrDayCoverage(calendar, date);
      return {
        date,
        label: this.text.day(date),
        hours: closed
          ? (day?.holidayName ?? this.text.t('hr.calendar.officeClosed'))
          : `${this.text.range(minutes(hours!.open), minutes(hours!.close))}`,
        axis: hours,
        closed,
        today: date === calendar.today,
        coverage: coverage
          ? this.text.t('hr.calendar.coverage', {
              x: this.text.number(Number(hoursLabel(coverage.covered))),
              y: this.text.number(Number(hoursLabel(coverage.open))),
            })
          : '–',
        nobody: !!coverage && coverage.covered === 0,
      };
    });
  });

  protected readonly rows = computed(() => {
    const calendar = this.calendar();
    const cells = indexHrCells(calendar.cells);
    const days = indexHrDays(calendar.days);
    return calendar.people.map((employee) => ({
      employee,
      name: hrName(employee),
      schedule: this.text.schedule(employee.pattern),
      cells: this.columns().map((column) => {
        const view = hrCellView(
          column.date,
          cells.get(hrCellKey(employee.id, column.date)),
          days.get(column.date),
          employee,
          calendar.today,
        );
        return { column, view, label: this.label(employee, view) };
      }),
    }));
  });

  protected readonly peopleLabel = computed(() =>
    this.text.plural('hr.n.people', this.calendar().people.length),
  );

  protected hoursText(view: HrCellView): string {
    return this.text.hours(view.minutes);
  }

  protected rangeText(view: HrCellView): string {
    return this.text.range(view.start, view.end);
  }

  private label(employee: HrEmployee, view: HrCellView): string {
    let state: string;
    if (view.kind === 'closed') state = this.text.t('hr.calendar.officeClosed');
    else if (view.kind === 'absence') state = this.text.type(view.absence!.type);
    else if (view.kind === 'hours') state = `${this.rangeText(view)} · ${this.hoursText(view)}`;
    else state = this.text.t('hr.calendar.notWorking');
    return this.text.t('hr.calendar.cellAria', {
      name: hrName(employee),
      date: this.text.day(view.date),
      state,
    });
  }

  protected onPick(employee: HrEmployee, date: string, event: Event): void {
    this.pick.emit({ employee, date, anchor: event.currentTarget as Element });
  }
}

function minutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
