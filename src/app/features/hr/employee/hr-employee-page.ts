import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay } from '@angular/cdk/overlay';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { HrCellAbsence } from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrCellKey, hrCellView, indexHrCells, indexHrDays } from '@domain/hr/hr-calendar';
import { mondayOf, monthEnd, monthOf, monthStart, shiftMonth } from '@domain/hr/hr-dates';
import { hrName } from '@domain/hr/hr-entry';
import { HrService } from '@services/hr/hr.service';
import { V2Button } from '../../v2/ui/v2-button';
import { V2StatePanel } from '../../v2/ui/v2-state-panel';
import { type HrDayAccess, HrDayPopover } from '../calendar/hr-day-popover';
import { HR_POPOVER_POSITIONS, type HrDayPick } from '../calendar/hr-grid.types';
import { HrDialogs } from '../dialogs/hr-dialogs';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import { HrMonthCard } from '../shared/hr-month-card';
import { HrAbsenceChip } from '../ui/hr-absence-chip';
import { HrAvatar } from '../ui/hr-avatar';
import { HrBalanceTile } from '../ui/hr-balance-tile';
import { HrEmployeeEntries } from './hr-employee-entries';
import { HrEmployeeLeave } from './hr-employee-leave';
import { HrEmployeeSchedule } from './hr-employee-schedule';
import { HrEmployeeSettings } from './hr-employee-settings';

const TABS = ['calendar', 'schedule', 'leave', 'entries', 'settings'] as const;
type HrEmployeeTab = (typeof TABS)[number];

// Employee page (HR-employee-calendar / -schedule / -leave / -entries / -settings.dc.html, super
// admin). Route param `employeeId`; query params `tab` and `month`. The calendar tab is the
// person's month, editable by the admin including closed months (banner).
@Component({
  selector: 'app-hr-employee-page',
  imports: [
    CdkConnectedOverlay,
    CdkTrapFocus,
    HrAbsenceChip,
    HrAvatar,
    HrBalanceTile,
    HrDayPopover,
    HrEmployeeEntries,
    HrEmployeeLeave,
    HrEmployeeSchedule,
    HrEmployeeSettings,
    HrMonthCard,
    RouterLink,
    TranslatePipe,
    V2Button,
    V2StatePanel,
  ],
  templateUrl: './hr-employee-page.html',
  styleUrl: './hr-employee-page.scss',
})
export class HrEmployeePage {
  private readonly hr = inject(HrService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(HrDialogs);
  protected readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  readonly employeeId = input.required<string>();
  readonly tab = input<string>();
  readonly month = input<string>();

  protected readonly positions = HR_POPOVER_POSITIONS;
  protected readonly selection = signal<HrDayPick | null>(null);
  protected readonly moreOpen = signal(false);
  protected readonly stopRequested = signal(false);

  protected readonly detail = resource({
    params: () => ({ id: this.employeeId(), v: this.hr.changes() }),
    loader: ({ params }) => this.hr.employee(params.id),
  });
  protected readonly data = computed(() =>
    this.detail.hasValue() ? this.detail.value() : undefined,
  );
  protected readonly today = computed(() => this.data()?.today ?? '');
  protected readonly activeTab = computed<HrEmployeeTab>(() =>
    TABS.includes(this.tab() as HrEmployeeTab) ? (this.tab() as HrEmployeeTab) : 'calendar',
  );
  protected readonly shownMonth = computed(() => {
    const month = this.month();
    if (month && /^\d{4}-\d{2}$/.test(month)) return month;
    return this.today() ? monthOf(this.today()) : '';
  });
  protected readonly closedMonth = computed(
    () => !!this.shownMonth() && this.shownMonth() < monthOf(this.today()),
  );

  protected readonly calendar = resource({
    params: () => {
      const d = this.data();
      const month = this.shownMonth();
      if (!d || !month) return undefined;
      return { office: d.office.id, id: d.employee.id, month, v: this.hr.changes() };
    },
    loader: ({ params }) =>
      this.hr.calendar({
        officeId: params.office,
        employeeId: params.id,
        from: monthStart(params.month),
        to: monthEnd(params.month),
      }),
  });

  private readonly todayCalendar = resource({
    params: () => {
      const d = this.data();
      return d
        ? { office: d.office.id, id: d.employee.id, today: d.today, v: this.hr.changes() }
        : undefined;
    },
    loader: ({ params }) =>
      this.hr.calendar({
        officeId: params.office,
        employeeId: params.id,
        from: params.today,
        to: params.today,
      }),
  });

  private readonly report = resource({
    params: () => {
      const d = this.data();
      const month = this.shownMonth();
      return d && month ? { office: d.office.id, month, v: this.hr.changes() } : undefined;
    },
    loader: ({ params }) =>
      this.hr.report({ officeId: params.office, period: 'month', month: params.month }),
  });

  protected readonly name = computed(() => hrName(this.data()?.employee));
  protected readonly flexible = computed(() => this.data()?.employee.pattern?.kind === 'flexible');

  protected readonly todayStatus = computed(() => {
    const d = this.data();
    if (!d || !this.todayCalendar.hasValue()) return null;
    const cal = this.todayCalendar.value();
    const cell = cal.cells.find((c) => c.employeeId === d.employee.id);
    const view = hrCellView(d.today, cell, cal.days[0], d.employee, d.today);
    if (view.kind === 'absence' && view.absence) return { absence: view.absence, text: '' };
    if (view.kind === 'hours') {
      return {
        absence: null,
        text: this.text.t('hr.employee.workingToday', {
          hours: this.text.range(view.start, view.end),
        }),
      };
    }
    return { absence: null, text: this.text.t('hr.employee.offToday') };
  });

  protected readonly subtitle = computed(() => {
    const d = this.data();
    if (!d) return '';
    return this.text.t('hr.employee.subtitle', {
      position: d.employee.position || this.text.t('hr.employee.noPosition'),
      office: this.text.officeName(d.office),
      schedule: this.text.schedule(d.employee.pattern),
      date: this.text.date(d.employee.startedOn),
    });
  });

  protected readonly tabs = computed(() =>
    TABS.map((id) => ({
      id,
      label: this.text.t(`hr.employee.tab.${id}` as MessageKey),
      active: id === this.activeTab(),
    })),
  );

  protected readonly tiles = computed(() => {
    const d = this.data();
    if (!d) return null;
    const row = this.report.hasValue()
      ? this.report.value().rows?.find((r) => r.person.employeeId === d.employee.id)
      : undefined;
    const year = Number(this.shownMonth().slice(0, 4));
    const leave = d.leave.find((l) => l.year === year) ?? d.leave[0];
    const vacation = leave?.balance;
    return {
      planned: {
        label: this.text.t('hr.employee.tile.planned', {
          month: this.text.monthName(this.shownMonth()),
        }),
        value: row
          ? this.text.t('hr.employee.monthDays', { n: this.text.number(row.totals.plannedDays) })
          : '–',
        sub: row
          ? this.text.t('hr.employee.monthSub', {
              h: this.text.number(row.totals.plannedHours),
              norm: this.text.number(row.totals.normDays),
            })
          : '',
      },
      vacation: vacation
        ? {
            label: this.text.t('hr.me.tile.vacation', { year: vacation.year }),
            value: this.text.t('hr.employee.vacationValue', {
              used: this.text.number(vacation.used),
              limit: this.text.number(vacation.limit),
            }),
            sub:
              vacation.over > 0
                ? this.text.t('hr.employee.vacationOverSub', { n: this.text.number(vacation.over) })
                : this.text.t('hr.me.tile.vacationLeft', { n: this.text.number(vacation.left) }),
            used: vacation.used,
            limit: vacation.limit,
            year: vacation.year,
          }
        : null,
      makeup: {
        value: this.text.plural('hr.n.days', d.makeupOwed),
        sub: this.text.t(d.makeupOwed > 0 ? 'hr.me.tile.makeupHint' : 'hr.me.tile.makeupNone'),
        empty: d.makeupOwed === 0,
      },
    };
  });

  protected readonly access = computed<HrDayAccess>(() => ({
    admin: true,
    viewerEmployeeId: this.session.employee()?.id ?? null,
    today: this.today(),
    editableAbsencesFrom: null,
    editableHoursFrom: null,
  }));

  protected readonly picked = computed(() => {
    const pick = this.selection();
    if (!pick || !this.calendar.hasValue()) return null;
    const cal = this.calendar.value();
    return {
      ...pick,
      office: cal.office,
      cell: indexHrCells(cal.cells).get(hrCellKey(pick.employee.id, pick.date)),
      day: indexHrDays(cal.days).get(pick.date),
    };
  });

  protected readonly errorCode = computed(() => {
    const error = this.detail.error();
    return error instanceof KolssApiError ? error.code : 'network_error';
  });

  protected setTab(tab: HrEmployeeTab): void {
    this.moreOpen.set(false);
    void this.router.navigate([], {
      queryParams: { tab: tab === 'calendar' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  protected stepMonth(delta: number): void {
    this.selection.set(null);
    void this.router.navigate([], {
      queryParams: { month: shiftMonth(this.shownMonth(), delta) },
      queryParamsHandling: 'merge',
    });
  }

  protected stopTracking(): void {
    this.stopRequested.set(true);
    this.setTab('settings');
  }

  protected addAbsence(): void {
    this.dialogs.absence({ employeeId: this.employeeId() });
  }

  protected planHours(): void {
    if (!this.flexible()) return;
    this.dialogs.planHours({ employeeId: this.employeeId() });
  }

  protected editLimit(): void {
    const d = this.data();
    if (!d) return;
    this.dialogs.leaveLimit({
      employeeId: d.employee.id,
      name: this.name(),
      defaultDays: d.office.defaultVacationDays,
      leave: d.leave,
      year: this.tiles()?.vacation?.year ?? Number(d.today.slice(0, 4)),
    });
  }

  protected changeSchedule(): void {
    const d = this.data();
    if (!d) return;
    this.dialogs.schedule({
      employeeId: d.employee.id,
      name: this.name(),
      office: d.office,
      pattern: d.employee.pattern,
      today: d.today,
    });
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
    this.selection.set(null);
    this.dialogs.planHours({ employeeId: this.employeeId(), weekStart: mondayOf(date) });
  }
}
