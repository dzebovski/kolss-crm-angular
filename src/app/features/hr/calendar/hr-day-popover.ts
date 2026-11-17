import { Component, computed, inject, input, output } from '@angular/core';

import type {
  HrCell,
  HrCellAbsence,
  HrDayTotal,
  HrEmployee,
  HrOffice,
} from '@core/api/generated/kolss-api.types';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrOfficeHoursOn, hrWeekAxis } from '@domain/hr/hr-calendar';
import { minutesToTime } from '@domain/hr/hr-dates';
import { hrDateError, hrName } from '@domain/hr/hr-entry';
import { hrQuickWorkday } from '@domain/hr/hr-plan';
import { V2Button } from '../../v2/ui/v2-button';
import { HrText } from '../hr-text';
import { HrAbsenceChip } from '../ui/hr-absence-chip';
import { HrAvatar } from '../ui/hr-avatar';
import { HrHourBar } from '../ui/hr-hour-bar';

/** What the viewer may do from a day popover, decided by the page. */
export interface HrDayAccess {
  readonly admin: boolean;
  readonly viewerEmployeeId: string | null;
  readonly today: string;
  readonly editableAbsencesFrom: string | null;
  readonly editableHoursFrom: string | null;
}

/**
 * Day popover (HR-calendar-day-popover.dc.html): header with the person and date; an absence
 * (chip, planned hours struck through, comment, created) or the planned hours on the office
 * hour track; "Open employee" for HR admins and "Edit" when the viewer may change the day.
 */
@Component({
  selector: 'app-hr-day-popover',
  imports: [HrAbsenceChip, HrAvatar, HrHourBar, TranslatePipe, V2Button],
  host: { role: 'dialog', '[attr.aria-label]': 'title()' },
  templateUrl: './hr-day-popover.html',
  styleUrl: './hr-day-popover.scss',
})
export class HrDayPopover {
  protected readonly text = inject(HrText);

  readonly employee = input.required<HrEmployee>();
  readonly date = input.required<string>();
  readonly cell = input<HrCell | undefined>(undefined);
  readonly day = input<HrDayTotal | undefined>(undefined);
  readonly office = input.required<HrOffice>();
  readonly access = input.required<HrDayAccess>();
  /** Make-up owed of the viewer (shown on their own "Day off — to make up"). */
  readonly makeupOwed = input<number | null>(null);

  readonly closed = output<void>();
  readonly editAbsence = output<HrCellAbsence>();
  readonly editHours = output<string>();
  readonly addAbsence = output<string>();
  readonly startTracking = output<string>();
  readonly setWorkday = output<{
    readonly date: string;
    readonly start: string;
    readonly end: string;
  }>();
  readonly openEmployee = output<string>();

  protected readonly name = computed(() => hrName(this.employee()));
  protected readonly own = computed(() => this.employee().id === this.access().viewerEmployeeId);
  protected readonly title = computed(() => `${this.name()}, ${this.text.fullDay(this.date())}`);
  protected readonly absence = computed(() => this.cell()?.absence ?? null);
  protected readonly planned = computed(() => {
    const cell = this.cell();
    return cell?.plannedStart && cell.plannedEnd && cell.plannedMinutes > 0 ? cell : null;
  });
  protected readonly plannedText = computed(() => {
    const cell = this.planned();
    return cell
      ? `${cell.plannedStart!.slice(0, 5)}–${cell.plannedEnd!.slice(0, 5)} · ${this.text.hours(cell.plannedMinutes)}`
      : '';
  });
  protected readonly axis = computed(() => hrWeekAxis(this.office()));
  protected readonly officeRange = computed(() => {
    const hours = hrOfficeHoursOn(this.office(), this.date());
    return hours
      ? this.text.t('hr.popover.officeRange', {
          from: minutesToTime(hours.open),
          to: minutesToTime(hours.close),
        })
      : this.text.t('hr.calendar.officeClosed');
  });
  protected readonly schedule = computed(() => this.text.schedule(this.employee().pattern));

  protected readonly canEditAbsence = computed(() => {
    const absence = this.absence();
    if (!absence?.id) return false;
    const access = this.access();
    if (access.admin) return true;
    return (
      this.own() &&
      hrDateError(absence.dateFrom, access.today, access.editableAbsencesFrom) === null
    );
  });

  /** The day is inside the person's tracking (start … end / stop); outside, nothing shows. */
  protected readonly inTracking = computed(() => {
    const e = this.employee();
    const date = this.date();
    if (date < e.startedOn) return false;
    return [e.endedOn, e.trackedUntil].every((last) => !last || date <= last);
  });

  /** Admin, a day before the start: move the start back to fill in past days. */
  protected readonly canStartEarlier = computed(
    () => this.access().admin && this.date() < this.employee().startedOn,
  );

  /** A free day: the admin adds an absence for anyone, a person for own days in the window. */
  protected readonly canAddAbsence = computed(() => {
    if (this.absence() || !this.inTracking()) return false;
    const access = this.access();
    if (access.admin) return true;
    return (
      this.own() && hrDateError(this.date(), access.today, access.editableAbsencesFrom) === null
    );
  });

  protected readonly canEditHours = computed(() => {
    if (this.absence() || !this.inTracking() || this.employee().pattern?.kind !== 'flexible') {
      return false;
    }
    const access = this.access();
    if (access.admin) return true;
    return (
      this.own() && access.editableHoursFrom !== null && this.date() >= access.editableHoursFrom
    );
  });

  /** "Set workday": office opening + hours per day, on a day with nothing planned. */
  protected readonly quickWorkday = computed(() => {
    if (!this.canEditHours() || this.planned() || this.day()?.holidayName) return null;
    const pattern = this.employee().pattern;
    return pattern ? hrQuickWorkday(this.office(), this.date(), pattern.hoursPerDay) : null;
  });

  protected readonly pastLocked = computed(
    () => !this.access().admin && this.own() && this.date() <= this.access().today,
  );

  protected readonly created = computed(() => {
    const absence = this.absence();
    if (!absence?.createdAt) return '';
    const date = this.text.dateTime(absence.createdAt);
    return absence.createdByName
      ? this.text.t('hr.popover.createdBy', { date, name: absence.createdByName })
      : date;
  });
}
