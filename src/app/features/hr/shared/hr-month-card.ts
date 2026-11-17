import { Component, computed, inject, input, output, signal } from '@angular/core';

import type { HrCalendar, HrEmployee } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrCellKey, hrCellView, indexHrCells, indexHrDays } from '@domain/hr/hr-calendar';
import { monthOf, monthWeeks } from '@domain/hr/hr-dates';
import type { HrDayPick } from '../calendar/hr-grid.types';
import { HrText } from '../hr-text';
import { HrAbsenceChip } from '../ui/hr-absence-chip';
import { HrLegend } from '../ui/hr-legend';

/**
 * Month card of one person (HR-me.dc.html, HR-employee-calendar.dc.html): prev / next, Legend,
 * Monday-first day cells with the day number, a lock on read-only days, the Today tag, the
 * planned hours or the absence chip; a note under the grid.
 */
@Component({
  selector: 'app-hr-month-card',
  imports: [HrAbsenceChip, HrLegend, TranslatePipe],
  templateUrl: './hr-month-card.html',
  styleUrl: './hr-month-card.scss',
})
export class HrMonthCard {
  protected readonly text = inject(HrText);

  readonly calendar = input<HrCalendar | undefined>(undefined);
  readonly employee = input.required<HrEmployee>();
  readonly month = input.required<string>();
  readonly today = input.required<string>();
  /** First date the viewer may change (`null` = HR admin, nothing locked). */
  readonly editableFrom = input<string | null>(null);
  readonly note = input('');
  readonly loading = input(false);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly pick = output<HrDayPick>();

  protected readonly legendOpen = signal(false);
  protected readonly label = computed(() => this.text.month(this.month()));

  protected readonly weekdayHeads = computed(() =>
    [1, 2, 3, 4, 5, 6, 7].map((d) => this.text.weekday(d)),
  );

  protected readonly weeks = computed(() => {
    const calendar = this.calendar();
    const cells = indexHrCells(calendar?.cells ?? []);
    const days = indexHrDays(calendar?.days ?? []);
    const employee = this.employee();
    const editableFrom = this.editableFrom();
    return monthWeeks(this.month()).map((week) =>
      week.map((date) => {
        if (!date) return null;
        const view = hrCellView(
          date,
          cells.get(hrCellKey(employee.id, date)),
          days.get(date),
          employee,
          this.today(),
        );
        const holidayName = days.get(date)?.holidayName ?? null;
        return {
          view,
          number: this.text.dayNumber(date),
          locked: editableFrom !== null && date < editableFrom,
          holidayName,
          range: this.text.range(view.start, view.end),
          hours: this.text.hours(view.minutes),
          label: this.text.fullDay(date),
        };
      }),
    );
  });

  protected readonly isCurrentMonth = computed(() => monthOf(this.today()) === this.month());

  protected onPick(date: string, event: Event): void {
    this.pick.emit({ employee: this.employee(), date, anchor: event.currentTarget as Element });
  }
}
