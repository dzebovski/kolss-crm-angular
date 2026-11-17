import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay } from '@angular/cdk/overlay';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { HrCellAbsence } from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrCellKey, hrTodayStrip, indexHrCells, indexHrDays } from '@domain/hr/hr-calendar';
import { addDays, monthEnd, monthOf, monthStart, mondayOf, shiftMonth } from '@domain/hr/hr-dates';
import { hrName } from '@domain/hr/hr-entry';
import { hrWeekWithDay } from '@domain/hr/hr-plan';
import { HrService } from '@services/hr/hr.service';
import { V2Button } from '../../v2/ui/v2-button';
import { V2SegmentedControl, type V2SegmentOption } from '../../v2/ui/v2-segmented-control';
import { V2Select, type V2SelectOption } from '../../v2/ui/v2-select';
import { V2StatePanel } from '../../v2/ui/v2-state-panel';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrDialogs } from '../dialogs/hr-dialogs';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import { HrAbsenceChip } from '../ui/hr-absence-chip';
import { HrAvatar } from '../ui/hr-avatar';
import { HrLegend } from '../ui/hr-legend';
import { type HrDayAccess, HrDayPopover } from './hr-day-popover';
import { HR_POPOVER_POSITIONS, type HrDayPick } from './hr-grid.types';
import { HrMonthGrid } from './hr-month-grid';
import { HrWeekGrid } from './hr-week-grid';

type HrCalendarView = 'month' | 'week';

// Office calendar (HR-calendar-month / -week / -empty / -loading / -error.dc.html). Office,
// view and date live in the query params (`office`, `view`, `at`). Data: `GET /v1/hr/calendar`
// for the shown range and for today (the "In the office today" strip).
@Component({
  selector: 'app-hr-calendar-page',
  imports: [
    CdkConnectedOverlay,
    CdkTrapFocus,
    HrAbsenceChip,
    HrAvatar,
    HrDayPopover,
    HrLegend,
    HrMonthGrid,
    HrWeekGrid,
    TranslatePipe,
    V2Button,
    V2SegmentedControl,
    V2Select,
    V2StatePanel,
  ],
  templateUrl: './hr-calendar-page.html',
  styleUrl: './hr-calendar-page.scss',
})
export class HrCalendarPage {
  private readonly hr = inject(HrService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(HrDialogs);
  private readonly toast = inject(V2ToastService);
  protected readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  // Query params, bound by `withComponentInputBinding()`.
  readonly office = input<string>();
  readonly view = input<string>();
  readonly at = input<string>();

  protected readonly positions = HR_POPOVER_POSITIONS;
  protected readonly legendOpen = signal(false);
  protected readonly selection = signal<HrDayPick | null>(null);

  protected readonly mode = computed<HrCalendarView>(() =>
    this.view() === 'week' ? 'week' : 'month',
  );
  protected readonly today = computed(() => this.session.value()?.today ?? '');
  protected readonly anchor = computed(() => {
    const at = this.at();
    return at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : this.today();
  });
  protected readonly officeId = computed(() => this.office() || this.session.defaultOfficeId());

  protected readonly range = computed(() => {
    const anchor = this.anchor();
    if (!anchor) return null;
    if (this.mode() === 'week') {
      const monday = mondayOf(anchor);
      return { from: monday, to: addDays(monday, 6) };
    }
    const month = monthOf(anchor);
    return { from: monthStart(month), to: monthEnd(month) };
  });

  protected readonly calendar = resource({
    params: () => {
      const range = this.range();
      const officeId = this.officeId();
      return range && officeId ? { ...range, officeId, version: this.hr.changes() } : undefined;
    },
    loader: ({ params }) =>
      this.hr.calendar({ officeId: params.officeId, from: params.from, to: params.to }),
  });

  private readonly todayCalendar = resource({
    params: () => {
      const today = this.today();
      const officeId = this.officeId();
      return today && officeId ? { today, officeId, version: this.hr.changes() } : undefined;
    },
    loader: ({ params }) =>
      this.hr.calendar({ officeId: params.officeId, from: params.today, to: params.today }),
  });

  /**
   * When nobody is tracked in the shown range, the first tracked day in the next 62 days (the
   * API's longest range): people added with a later start date, shown as "starts on …".
   */
  private readonly upcoming = resource({
    params: () => {
      const range = this.range();
      const officeId = this.officeId();
      if (!range || !officeId || !this.calendar.hasValue()) return undefined;
      if (this.calendar.value().people.length > 0) return undefined;
      const from = addDays(range.to, 1);
      return { officeId, from, to: addDays(from, 61) };
    },
    loader: ({ params }) => this.hr.calendar(params),
  });

  /** The look-ahead is still loading: keep the skeleton instead of flashing "nobody". */
  protected readonly upcomingPending = computed(() => this.upcoming.isLoading());

  protected readonly startsOn = computed(() => {
    if (!this.upcoming.hasValue()) return null;
    const dates = this.upcoming.value().cells.map((cell) => cell.date);
    return dates.length > 0 ? dates.reduce((min, date) => (date < min ? date : min)) : null;
  });

  protected readonly data = computed(() =>
    this.calendar.hasValue() ? this.calendar.value() : undefined,
  );
  protected readonly strip = computed(() =>
    this.todayCalendar.hasValue() ? hrTodayStrip(this.todayCalendar.value()) : null,
  );
  protected readonly errorCode = computed(() => {
    const error = this.calendar.error();
    return error instanceof KolssApiError ? error.code : 'network_error';
  });

  protected readonly officeOptions = computed<V2SelectOption[]>(() =>
    this.session.offices().map((office) => ({
      value: office.id,
      label: this.text.officeName(office),
    })),
  );
  protected readonly officeName = computed(() => {
    const data = this.data();
    if (data) return this.text.officeName(data.office);
    return this.officeOptions().find((o) => o.value === this.officeId())?.label ?? '';
  });

  protected readonly viewOptions = computed<V2SegmentOption<HrCalendarView>[]>(() => [
    { value: 'month', label: this.text.t('hr.month') },
    { value: 'week', label: this.text.t('hr.week') },
  ]);

  protected readonly periodLabel = computed(() => {
    const range = this.range();
    if (!range) return '';
    if (this.mode() === 'month') return this.text.month(monthOf(range.from));
    return `${this.text.shortDate(range.from)} – ${this.text.date(range.to)}`;
  });

  protected readonly subtitle = computed(() => {
    const data = this.data();
    return this.mode() === 'week' && data
      ? this.text.t('hr.calendar.weekSubtitle', { hours: this.text.officeHours(data.office) })
      : this.text.t('hr.calendar.subtitle');
  });

  protected readonly canAdd = computed(
    () => this.session.canManageHr() || !!this.session.value()?.tracked,
  );

  protected readonly access = computed<HrDayAccess>(() => {
    const me = this.session.value();
    return {
      admin: this.session.canManageHr(),
      viewerEmployeeId: me?.employee?.id ?? null,
      today: this.today(),
      editableAbsencesFrom: me?.editableAbsencesFrom ?? null,
      editableHoursFrom: me?.editableHoursFrom ?? null,
    };
  });

  protected readonly picked = computed(() => {
    const pick = this.selection();
    const data = this.data();
    if (!pick || !data) return null;
    return {
      ...pick,
      cell: indexHrCells(data.cells).get(hrCellKey(pick.employee.id, pick.date)),
      day: indexHrDays(data.days).get(pick.date),
    };
  });

  protected readonly selectedKey = computed(() => {
    const pick = this.selection();
    return pick ? { employeeId: pick.employee.id, date: pick.date } : null;
  });

  protected personName = hrName;

  private navigate(params: Record<string, string | null>): void {
    this.selection.set(null);
    void this.router.navigate([], {
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setOffice(officeId: string): void {
    this.navigate({ office: officeId });
  }

  protected setView(view: HrCalendarView): void {
    this.navigate({ view: view === 'week' ? 'week' : null });
  }

  protected step(delta: number): void {
    const anchor = this.anchor();
    if (!anchor) return;
    const next =
      this.mode() === 'week'
        ? addDays(mondayOf(anchor), delta * 7)
        : monthStart(shiftMonth(monthOf(anchor), delta));
    this.navigate({ at: next });
  }

  protected goTo(date: string): void {
    this.navigate({ at: date });
  }

  protected goToday(): void {
    this.navigate({ at: null });
  }

  protected onPick(pick: HrDayPick): void {
    this.selection.set(pick);
  }

  protected closePopover(): void {
    this.selection.set(null);
  }

  protected addAbsence(): void {
    this.dialogs.absence({});
  }

  protected addPeople(): void {
    this.dialogs.addToTracking();
  }

  protected editAbsence(absence: HrCellAbsence): void {
    const pick = this.selection();
    this.selection.set(null);
    if (!pick || !absence.id) return;
    this.dialogs.absence({
      employeeId: pick.employee.id,
      entry: {
        id: absence.id,
        kind: 'absence',
        employeeId: pick.employee.id,
        type: absence.type === 'absent' ? 'sick' : absence.type,
        dateFrom: absence.dateFrom,
        dateTo: absence.dateTo,
        part: absence.part,
        comment: absence.comment ?? null,
      },
    });
  }

  protected editHours(date: string): void {
    const pick = this.selection();
    this.selection.set(null);
    if (!pick) return;
    this.dialogs.planHours({ employeeId: pick.employee.id, weekStart: mondayOf(date) });
  }

  protected addAbsenceOn(date: string): void {
    const pick = this.selection();
    this.selection.set(null);
    if (!pick) return;
    this.dialogs.absence({ employeeId: pick.employee.id, date });
  }

  /** Quick "Set workday": the week is re-sent with this day added (PUT replaces the week). */
  protected async setWorkday(day: { date: string; start: string; end: string }): Promise<void> {
    const pick = this.selection();
    this.selection.set(null);
    if (!pick) return;
    const employee = pick.employee;
    const weekStart = mondayOf(day.date);
    try {
      const week = await this.hr.calendar({
        officeId: employee.officeId,
        from: weekStart,
        to: addDays(weekStart, 6),
        employeeId: employee.id,
      });
      await this.hr.putWeekShifts(
        weekStart,
        hrWeekWithDay(week.cells, employee.id, {
          date: day.date,
          startTime: day.start,
          endTime: day.end,
        }),
        employee.id,
      );
      this.toast.show(this.text.t('hr.toast.saved'));
    } catch (error) {
      this.toast.show(this.text.saveError(error));
    }
  }

  /** Moves the person's tracking start back to `date` so past days can be filled in. */
  protected async startTracking(date: string): Promise<void> {
    const pick = this.selection();
    this.selection.set(null);
    if (!pick) return;
    try {
      await this.hr.updateEmployee(pick.employee.id, { startedOn: date });
      this.toast.show(this.text.t('hr.toast.saved'));
    } catch (error) {
      this.toast.show(this.text.saveError(error));
    }
  }

  protected openEmployee(id: string): void {
    this.selection.set(null);
    void this.router.navigate(['/hr/employees', id]);
  }
}
