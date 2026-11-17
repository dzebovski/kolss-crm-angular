import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import type { HrOffice, HrPattern } from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrOfficeHoursOn, hrWeekAxis } from '@domain/hr/hr-calendar';
import {
  addDays,
  hoursLabel,
  minutesToTime,
  mondayOf,
  timeOptions,
  timeToMinutes,
} from '@domain/hr/hr-dates';
import { hrName } from '@domain/hr/hr-entry';
import {
  hrPlanCounter,
  hrPlanDayState,
  hrPlanDefaultTimes,
  hrPlanMinutes,
  hrPlanRequest,
  hrPlanWeek,
  type HrPlanDay,
  type HrPlanDayState,
} from '@domain/hr/hr-plan';
import { HrService } from '@services/hr/hr.service';
import { V2DialogShell } from '../../v2/ui/dialog/v2-dialog-shell';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import type { HrPlanDialogData } from './hr-dialog.types';

/** Pixels per hour of the vertical day tracks (HR-plan-hours.dc.html: 24px / hour). */
const HOUR_PX = 24;

interface HrPlanTarget {
  readonly name: string;
  readonly pattern: HrPattern | null;
  readonly office: HrOffice;
  readonly makeupOwed: number;
}

// Plan my hours (HR-plan-hours.dc.html, ~900; mobile HR-plan-hours-mobile.dc.html): a week of
// Mon–Sat columns with the office-hour track, the planned bar, start / end selects and the
// make-up switch. Today and past days are locked (hours change from tomorrow). Under or over
// the weekly norm is shown in the counter, never blocked. Defaults to next week.
@Component({
  selector: 'app-hr-plan-hours-dialog',
  imports: [TranslatePipe, V2DialogShell],
  templateUrl: './hr-plan-hours-dialog.html',
  styleUrl: './hr-plan-hours-dialog.scss',
})
export class HrPlanHoursDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<HrPlanDialogData>(DIALOG_DATA) ?? {};
  private readonly hr = inject(HrService);
  private readonly toast = inject(V2ToastService);
  private readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  private readonly me = this.session.value();
  protected readonly admin = this.session.canManageHr();
  private readonly today = this.me?.today ?? '';
  protected readonly employeeId = this.data.employeeId ?? this.me?.employee?.id ?? '';
  protected readonly own = this.employeeId === this.me?.employee?.id;
  protected readonly hourPx = HOUR_PX;
  /** Phone layout (HR-plan-hours-mobile.dc.html): day cards, no footer note. */
  protected readonly phone = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 720px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly weekStart = signal(
    this.data.weekStart ?? addDays(mondayOf(this.today || '2026-01-05'), 7),
  );
  protected readonly saving = signal(false);
  protected readonly attempted = signal(false);
  protected readonly dayErrors = signal<Record<string, string>>({});

  private readonly detail = resource({
    params: () => (this.own ? undefined : { id: this.employeeId }),
    loader: ({ params }) => this.hr.employee(params.id),
  });

  protected readonly target = computed<HrPlanTarget | null>(() => {
    if (this.own && this.me?.office) {
      return {
        name: hrName(this.me.employee),
        pattern: this.me.employee?.pattern ?? null,
        office: this.me.office,
        makeupOwed: this.me.makeupOwed,
      };
    }
    if (this.detail.hasValue()) {
      const d = this.detail.value();
      return {
        name: hrName(d.employee),
        pattern: d.employee.pattern,
        office: d.office,
        makeupOwed: d.makeupOwed,
      };
    }
    return null;
  });

  private readonly week = resource({
    params: () => {
      const office = this.target()?.office.id;
      return office ? { office, from: this.weekStart() } : undefined;
    },
    loader: ({ params }) =>
      this.hr.calendar({
        officeId: params.office,
        from: params.from,
        to: addDays(params.from, 6),
        employeeId: this.employeeId,
      }),
  });

  private readonly cells = computed(() =>
    this.week.hasValue()
      ? this.week.value().cells.filter((cell) => cell.employeeId === this.employeeId)
      : [],
  );

  /** Editable copy of the week, reseeded whenever another week loads. */
  protected readonly days = linkedSignal<readonly HrPlanDay[]>(() =>
    hrPlanWeek(this.weekStart(), this.cells()),
  );

  private readonly closedDates = computed(
    () =>
      new Set(
        this.week.hasValue()
          ? this.week
              .value()
              .days.filter((day) => !!day.holidayKind)
              .map((day) => day.date)
          : [],
      ),
  );

  private readonly editableFrom = computed(() =>
    this.admin ? null : (this.me?.editableHoursFrom ?? addDays(this.today, 1)),
  );

  protected readonly axis = computed(() => {
    const office = this.target()?.office;
    return office ? hrWeekAxis(office) : { open: 10 * 60, close: 19 * 60 };
  });

  protected readonly hourLabels = computed(() => {
    const out: string[] = [];
    for (let t = this.axis().open; t <= this.axis().close; t += 60) out.push(minutesToTime(t));
    return out;
  });

  protected readonly trackHeight = computed(
    () => ((this.axis().close - this.axis().open) / 60) * HOUR_PX,
  );

  protected readonly columns = computed(() => {
    const target = this.target();
    if (!target) return [];
    const cells = this.cells();
    return this.days().map((day, index) => {
      const cell = cells.find((c) => c.date === day.date);
      const state = hrPlanDayState(
        day,
        target.office,
        cell,
        this.editableFrom(),
        this.closedDates(),
      );
      const hours = hrOfficeHoursOn(target.office, day.date);
      const options = hours
        ? timeOptions(minutesToTime(hours.open), minutesToTime(hours.close))
        : [];
      const start = timeToMinutes(day.start);
      const end = timeToMinutes(day.end);
      const bar =
        start !== null && end !== null && end > start
          ? {
              top: ((start - this.axis().open) / 60) * HOUR_PX,
              height: ((end - start) / 60) * HOUR_PX,
            }
          : null;
      return {
        index,
        day,
        state,
        bar,
        options,
        editable: state !== 'locked' && state !== 'closed' && state !== 'absence',
        label: this.text.day(day.date),
        today: day.date === this.today,
        open: hours
          ? {
              top: ((hours.open - this.axis().open) / 60) * HOUR_PX,
              height: ((hours.close - hours.open) / 60) * HOUR_PX,
            }
          : null,
        message: this.dayErrors()[day.date] ?? this.message(state, day, target.office),
      };
    });
  });

  protected readonly counter = computed(() =>
    hrPlanCounter(this.days(), this.target()?.pattern ?? null),
  );
  protected readonly counterText = computed(() => {
    const c = this.counter();
    return this.text.t('hr.plan.counter', {
      h: this.text.number(Number(hoursLabel(c.minutes))),
      nh: this.text.number(Number(hoursLabel(c.normMinutes))),
      d: c.days,
      nd: c.normDays,
    });
  });

  protected readonly weekTag = computed(() => {
    const thisWeek = mondayOf(this.today);
    if (this.weekStart() === thisWeek) return this.text.t('hr.plan.thisWeek');
    if (this.weekStart() === addDays(thisWeek, 7)) return this.text.t('hr.plan.nextWeekTag');
    return '';
  });
  protected readonly weekLabel = computed(
    () =>
      `${this.text.shortDate(this.weekStart())} – ${this.text.date(addDays(this.weekStart(), 5))}`,
  );

  protected readonly title = computed(() =>
    this.own
      ? this.text.t('hr.plan.title')
      : this.text.t('hr.plan.titleFor', { name: this.target()?.name ?? '' }),
  );
  protected readonly subtitle = computed(() => {
    const pattern = this.target()?.pattern;
    return pattern
      ? this.text.t('hr.plan.subtitle', {
          days: pattern.daysPerWeek,
          hours: this.text.number(pattern.hoursPerDay),
        })
      : '';
  });

  private readonly invalidStates: readonly HrPlanDayState[] = ['outside', 'end_before_start'];
  protected readonly invalid = computed(() =>
    this.columns().some((column) => this.invalidStates.includes(column.state)),
  );
  protected readonly errorCount = computed(
    () => this.columns().filter((column) => this.invalidStates.includes(column.state)).length,
  );

  protected readonly dirty = computed(() => {
    const seeded = hrPlanWeek(this.weekStart(), this.cells());
    return JSON.stringify(seeded) !== JSON.stringify(this.days());
  });

  private message(state: HrPlanDayState, day: HrPlanDay, office: HrOffice): string {
    switch (state) {
      case 'locked':
        return this.text.t(day.date === this.today ? 'hr.plan.lockedToday' : 'hr.plan.lockedPast');
      case 'closed':
        return this.text.t('hr.plan.closed');
      case 'absence':
        return this.text.t('hr.plan.absence');
      case 'empty':
        return this.text.t('hr.plan.notPlanned');
      case 'end_before_start':
        return this.text.t('hr.plan.endBeforeStart');
      case 'outside': {
        const hours = hrOfficeHoursOn(office, day.date);
        return this.text.t('hr.plan.outside', {
          day: this.text.weekdayOf(day.date),
          from: hours ? minutesToTime(hours.open) : '',
          to: hours ? minutesToTime(hours.close) : '',
        });
      }
      default: {
        const h = this.text.number(Number(hoursLabel(hrPlanMinutes(day))));
        return this.text.t(day.makeup ? 'hr.plan.hoursMakeup' : 'hr.plan.hours', { h });
      }
    }
  }

  private update(index: number, change: Partial<HrPlanDay>): void {
    this.dayErrors.set({});
    this.days.update((days) => days.map((day, i) => (i === index ? { ...day, ...change } : day)));
  }

  protected setStart(index: number, value: string): void {
    this.update(index, { start: value });
  }

  protected setEnd(index: number, value: string): void {
    this.update(index, { end: value });
  }

  protected setMakeup(index: number, value: boolean): void {
    this.update(index, { makeup: value });
  }

  protected planDay(index: number): void {
    const target = this.target();
    const day = this.days()[index];
    if (!target || !day) return;
    const times = hrPlanDefaultTimes(target.office, day.date, target.pattern);
    if (times) this.update(index, times);
  }

  protected clearDay(index: number): void {
    this.update(index, { start: '', end: '', makeup: false });
  }

  protected stepWeek(delta: number): void {
    this.dayErrors.set({});
    this.weekStart.update((monday) => addDays(monday, delta * 7));
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    this.attempted.set(true);
    if (this.invalid()) return;
    this.saving.set(true);
    try {
      await this.hr.putWeekShifts(
        this.weekStart(),
        hrPlanRequest(this.days(), this.editableFrom()),
        this.own ? undefined : this.employeeId,
      );
      this.toast.show(this.text.t('hr.toast.saved'));
      this.dialogRef.close(true);
    } catch (error) {
      this.saving.set(false);
      if (error instanceof KolssApiError && Object.keys(error.fieldErrors).length > 0) {
        const byDay: Record<string, string> = {};
        for (const [field, code] of Object.entries(error.fieldErrors)) {
          const date = field.replace(/^days\./, '');
          byDay[date] = this.text.ruleError(code, {
            today: this.editableFrom() ?? this.today,
            hours: true,
          });
        }
        this.dayErrors.set(byDay);
        return;
      }
      this.toast.show(this.text.saveError(error, { today: this.today }));
    }
  }
}
