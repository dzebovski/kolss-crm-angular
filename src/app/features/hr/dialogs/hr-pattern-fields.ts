import { Component, computed, inject, input, model } from '@angular/core';

import type { HrOffice, HrPatternKind } from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrWeekAxis } from '@domain/hr/hr-calendar';
import { minutesToTime, timeOptions } from '@domain/hr/hr-dates';
import {
  hrOpenWeekdays,
  hrSpanHours,
  validateHrPattern,
  type HrPatternDraft,
} from '@domain/hr/hr-pattern';
import { V2FormField } from '../../v2/ui/dialog/v2-form-field';
import { HrText } from '../hr-text';

/**
 * Schedule pattern fields shared by the schedule editor and Add to tracking
 * (HR-schedule-editor.dc.html): type, working days, start / end, hours per day (fixed) or
 * days per week × hours per day (flexible). Errors show after the first save attempt.
 */
@Component({
  selector: 'app-hr-pattern-fields',
  imports: [TranslatePipe, V2FormField],
  templateUrl: './hr-pattern-fields.html',
  styleUrl: './hr-pattern-fields.scss',
})
export class HrPatternFields {
  protected readonly text = inject(HrText);

  readonly draft = model.required<HrPatternDraft>();
  readonly office = input.required<HrOffice>();
  readonly showErrors = input(false);

  protected readonly openDays = computed(() => new Set(hrOpenWeekdays(this.office())));
  protected readonly weekdays = computed(() =>
    [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      label: this.text.weekday(day),
      on: this.draft().weekdays.includes(day),
      closed: !this.openDays().has(day),
    })),
  );
  protected readonly times = computed(() => {
    const axis = hrWeekAxis(this.office());
    return timeOptions(minutesToTime(axis.open), minutesToTime(axis.close));
  });
  protected readonly dayOptions = [1, 2, 3, 4, 5, 6];
  protected readonly autoHours = computed(() => {
    const draft = this.draft();
    return hrSpanHours(draft.start, draft.end);
  });

  protected readonly errors = computed(() =>
    this.showErrors() ? validateHrPattern(this.draft(), this.office()) : {},
  );
  protected readonly startError = computed(() => {
    const day = this.errors().outsideDay;
    return day ? this.text.t('hr.pattern.outsideError', { day: this.text.weekday(day) }) : '';
  });

  protected setKind(kind: HrPatternKind): void {
    this.patch({ kind });
  }

  protected toggleDay(day: number): void {
    if (!this.openDays().has(day)) return;
    const days = this.draft().weekdays;
    this.patch({
      weekdays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    });
  }

  protected setTime(field: 'start' | 'end', value: string): void {
    const next = { ...this.draft(), [field]: value };
    const before = hrSpanHours(this.draft().start, this.draft().end);
    // Keep "Hours per day" following the times while it still holds the auto value.
    const followsAuto =
      this.draft().hoursPerDay === '' || Number(this.draft().hoursPerDay) === before;
    const span = hrSpanHours(next.start, next.end);
    this.draft.set(followsAuto && span !== null ? { ...next, hoursPerDay: String(span) } : next);
  }

  protected patch(change: Partial<HrPatternDraft>): void {
    this.draft.update((draft) => ({ ...draft, ...change }));
  }
}
