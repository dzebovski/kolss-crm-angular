import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CdkConnectedOverlay } from '@angular/cdk/overlay';
import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { HrCellAbsence, HrEntry } from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrCellKey, indexHrCells, indexHrDays } from '@domain/hr/hr-calendar';
import { mondayOf, monthEnd, monthStart, shiftMonth } from '@domain/hr/hr-dates';
import { HrService } from '@services/hr/hr.service';
import { V2Button } from '../../v2/ui/v2-button';
import { V2SegmentedControl, type V2SegmentOption } from '../../v2/ui/v2-segmented-control';
import { V2StatePanel } from '../../v2/ui/v2-state-panel';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { type HrDayAccess, HrDayPopover } from '../calendar/hr-day-popover';
import { HR_POPOVER_POSITIONS, type HrDayPick } from '../calendar/hr-grid.types';
import { HrDialogs } from '../dialogs/hr-dialogs';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import { HrEntriesList } from '../shared/hr-entries-list';
import { HrMonthCard } from '../shared/hr-month-card';
import { HrBalanceTile } from '../ui/hr-balance-tile';

type HrEntriesPeriod = 'month' | 'year';

// My time (HR-me / -fixed / -over-limit / -not-tracked / -loading / -error / -mobile.dc.html):
// "Plan my hours" (flexible only) and "Add absence", 4 tiles, the month card and "My entries".
@Component({
  selector: 'app-hr-me-page',
  imports: [
    CdkConnectedOverlay,
    CdkTrapFocus,
    HrBalanceTile,
    HrDayPopover,
    HrEntriesList,
    HrMonthCard,
    RouterLink,
    TranslatePipe,
    V2Button,
    V2SegmentedControl,
    V2StatePanel,
  ],
  templateUrl: './hr-me-page.html',
  styleUrl: './hr-me-page.scss',
})
export class HrMePage {
  private readonly hr = inject(HrService);
  private readonly dialogs = inject(HrDialogs);
  private readonly toast = inject(V2ToastService);
  protected readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  protected readonly me = this.session.value;
  protected readonly employee = computed(() => this.me()?.employee ?? null);
  protected readonly flexible = computed(() => this.employee()?.pattern?.kind === 'flexible');

  protected readonly month = linkedSignal(() => this.me()?.month ?? '');
  protected readonly period = signal<HrEntriesPeriod>('month');
  protected readonly selection = signal<HrDayPick | null>(null);
  protected readonly busyId = signal<string | null>(null);

  protected readonly positions = HR_POPOVER_POSITIONS;

  protected readonly calendar = resource({
    params: () => {
      const me = this.me();
      const month = this.month();
      if (!me?.employee || !me.office || !month) return undefined;
      return {
        officeId: me.office.id,
        employeeId: me.employee.id,
        month,
        version: this.hr.changes(),
      };
    },
    loader: ({ params }) =>
      this.hr.calendar({
        officeId: params.officeId,
        employeeId: params.employeeId,
        from: monthStart(params.month),
        to: monthEnd(params.month),
      }),
  });

  protected readonly entries = resource({
    params: () => {
      const me = this.me();
      if (!me?.employee) return undefined;
      const year = me.today.slice(0, 4);
      return this.period() === 'month'
        ? {
            id: me.employee.id,
            from: monthStart(me.month),
            to: monthEnd(me.month),
            v: this.hr.changes(),
          }
        : { id: me.employee.id, from: `${year}-01-01`, to: `${year}-12-31`, v: this.hr.changes() };
    },
    loader: ({ params }) =>
      this.hr.entries({ employeeId: params.id, from: params.from, to: params.to }),
  });

  protected readonly periodOptions = computed<V2SegmentOption<HrEntriesPeriod>[]>(() => [
    { value: 'month', label: this.text.t('hr.entries.month') },
    { value: 'year', label: this.text.t('hr.entries.year') },
  ]);

  protected readonly subtitle = computed(() => {
    const me = this.me();
    if (!me?.employee) return '';
    return this.text.t('hr.me.subtitle', {
      schedule: this.text.schedule(me.employee.pattern),
      office: this.text.officeName(me.office),
    });
  });

  protected readonly tiles = computed(() => {
    const me = this.me();
    if (!me) return null;
    const totals = me.monthTotals;
    const vacation = me.vacation;
    const next = me.nextWorkingDay;
    return {
      month: {
        value: totals ? this.text.plural('hr.n.days', totals.plannedDays) : '–',
        sub: totals
          ? this.text.t('hr.me.tile.monthSub', { hours: this.text.number(totals.plannedHours) })
          : '',
      },
      vacation: vacation
        ? {
            label: this.text.t('hr.me.tile.vacation', { year: vacation.year }),
            value: this.text.t('hr.me.tile.vacationValue', {
              used: this.text.number(vacation.used),
              limit: this.text.number(vacation.limit),
            }),
            sub:
              vacation.over > 0
                ? this.text.t('hr.me.tile.vacationOver', { n: this.text.number(vacation.over) })
                : this.text.t('hr.me.tile.vacationLeft', { n: this.text.number(vacation.left) }),
            used: vacation.used,
            limit: vacation.limit,
            empty: false,
          }
        : {
            label: this.text.t('hr.me.tile.vacation', { year: me.today.slice(0, 4) }),
            value: '–',
            sub: this.text.t('hr.me.tile.vacationEmpty'),
            used: 0,
            limit: null,
            empty: true,
          },
      makeup: {
        value: this.text.plural('hr.n.days', me.makeupOwed),
        sub: this.text.t(me.makeupOwed > 0 ? 'hr.me.tile.makeupHint' : 'hr.me.tile.makeupNone'),
        empty: me.makeupOwed === 0,
      },
      next: next
        ? {
            value: this.text.day(next.date),
            sub: `${this.text.range(next.start, next.end)} · ${this.text.hours(next.minutes)}`,
          }
        : { value: '–', sub: this.text.t('hr.me.tile.nextNone') },
    };
  });

  protected readonly access = computed<HrDayAccess>(() => {
    const me = this.me();
    return {
      admin: this.session.canManageHr(),
      viewerEmployeeId: me?.employee?.id ?? null,
      today: me?.today ?? '',
      editableAbsencesFrom: me?.editableAbsencesFrom ?? null,
      editableHoursFrom: me?.editableHoursFrom ?? null,
    };
  });

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
    const error = this.session.me.error();
    return error instanceof KolssApiError ? error.code : 'network_error';
  });

  protected shiftMonth(delta: number): void {
    this.selection.set(null);
    this.month.update((month) => shiftMonth(month, delta));
  }

  protected addAbsence(): void {
    this.dialogs.absence({});
  }

  protected planHours(): void {
    this.dialogs.planHours({});
  }

  protected editEntry(entry: HrEntry): void {
    this.dialogs.absence({
      employeeId: entry.employeeId,
      entry: {
        id: entry.id,
        kind: entry.kind,
        employeeId: entry.employeeId,
        type: entry.type,
        dateFrom: entry.dateFrom,
        dateTo: entry.dateTo,
        part: entry.part,
        comment: entry.comment,
      },
    });
  }

  protected async removeEntry(entry: HrEntry): Promise<void> {
    this.busyId.set(entry.id);
    try {
      await this.hr.deleteEntry(entry);
      this.toast.show(this.text.t('hr.toast.deleted'));
    } catch (error) {
      this.toast.show(this.text.saveError(error, { today: this.me()?.today }));
    } finally {
      this.busyId.set(null);
    }
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
    this.dialogs.planHours({ weekStart: mondayOf(date) });
  }
}
