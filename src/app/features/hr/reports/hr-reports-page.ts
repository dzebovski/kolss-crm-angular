import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { HrReportPeriod, HrReportRow, HrTotals } from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { monthOf, shiftMonth } from '@domain/hr/hr-dates';
import { HrService } from '@services/hr/hr.service';
import { V2Button } from '../../v2/ui/v2-button';
import { V2SegmentedControl, type V2SegmentOption } from '../../v2/ui/v2-segmented-control';
import { V2Select, type V2SelectOption } from '../../v2/ui/v2-select';
import { V2StatePanel } from '../../v2/ui/v2-state-panel';
import { V2ToastService } from '../../v2/ui/toast/v2-toast';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import { HrAvatar } from '../ui/hr-avatar';

/** Month columns, in board order (HR-reports-month.dc.html). */
const MONTH_COLUMNS = [
  'norm',
  'plannedDays',
  'plannedHours',
  'vacation',
  'sick',
  'off',
  'owe',
  'makeupDone',
  'owed',
  'remote',
  'occasional',
  'other',
  'vacationLeft',
] as const;
type HrMonthColumn = (typeof MONTH_COLUMNS)[number];

function monthValue(row: HrReportRow, column: HrMonthColumn): number {
  const t: HrTotals = row.totals;
  switch (column) {
    case 'norm':
      return t.normDays;
    case 'plannedDays':
      return t.plannedDays;
    case 'plannedHours':
      return t.plannedHours;
    case 'vacation':
      return t.vacation;
    case 'sick':
      return t.sick;
    case 'off':
      return t.dayOffUnpaid;
    case 'owe':
      return t.dayOffMakeup;
    case 'makeupDone':
      return t.makeupDone;
    case 'owed':
      return row.makeupOwed;
    case 'remote':
      return t.remote;
    case 'occasional':
      return t.occasional;
    case 'other':
      return t.other;
    case 'vacationLeft':
      return row.vacationOver > 0 ? -row.vacationOver : row.vacationLeft;
  }
}

// Reports (HR-reports-month / -year / -empty.dc.html, super admin): plan-based totals per
// person for one office, by month (13 columns) or by year (12 months). Query params `office`,
// `period`, `at` (`YYYY-MM` or `YYYY`). Export is CSV only (Q-H31); "All offices" is not in
// the API (reports need one office).
@Component({
  selector: 'app-hr-reports-page',
  imports: [HrAvatar, TranslatePipe, V2Button, V2SegmentedControl, V2Select, V2StatePanel],
  templateUrl: './hr-reports-page.html',
  styleUrl: './hr-reports-page.scss',
})
export class HrReportsPage {
  private readonly hr = inject(HrService);
  private readonly router = inject(Router);
  private readonly toast = inject(V2ToastService);
  private readonly document = inject(DOCUMENT);
  protected readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  readonly office = input<string>();
  readonly period = input<string>();
  readonly at = input<string>();

  protected readonly columns = MONTH_COLUMNS;
  protected readonly exporting = signal(false);

  protected readonly officeId = computed(() => this.office() || this.session.defaultOfficeId());
  protected readonly mode = computed<HrReportPeriod>(() =>
    this.period() === 'year' ? 'year' : 'month',
  );
  private readonly today = computed(() => this.session.value()?.today ?? '');
  protected readonly shownMonth = computed(() => {
    const at = this.at();
    if (at && /^\d{4}-\d{2}$/.test(at)) return at;
    if (at && /^\d{4}$/.test(at)) return `${at}-01`;
    return this.today() ? monthOf(this.today()) : '';
  });
  protected readonly shownYear = computed(() => Number(this.shownMonth().slice(0, 4)));

  protected readonly report = resource({
    params: () => {
      const officeId = this.officeId();
      const month = this.shownMonth();
      if (!officeId || !month) return undefined;
      return this.mode() === 'year'
        ? { officeId, period: 'year' as const, year: this.shownYear(), v: this.hr.changes() }
        : { officeId, period: 'month' as const, month, v: this.hr.changes() };
    },
    loader: ({ params }) =>
      this.hr.report(
        params.period === 'year'
          ? { officeId: params.officeId, period: 'year', year: params.year }
          : { officeId: params.officeId, period: 'month', month: params.month },
      ),
  });
  protected readonly data = computed(() =>
    this.report.hasValue() ? this.report.value() : undefined,
  );

  protected readonly officeOptions = computed<V2SelectOption[]>(() =>
    this.session.offices().map((o) => ({ value: o.id, label: this.text.officeName(o) })),
  );
  protected readonly officeName = computed(
    () => this.officeOptions().find((o) => o.value === this.officeId())?.label ?? '',
  );
  protected readonly modeOptions = computed<V2SegmentOption<HrReportPeriod>[]>(() => [
    { value: 'month', label: this.text.t('hr.month') },
    { value: 'year', label: this.text.t('hr.reports.year') },
  ]);
  protected readonly periodLabel = computed(() => {
    const month = this.shownMonth();
    // Empty until `/hr/me` brings today (cold load).
    if (!month) return '';
    return this.mode() === 'year' ? String(this.shownYear()) : this.text.month(month);
  });
  protected readonly columnLabels = computed(() =>
    MONTH_COLUMNS.map((c) => this.text.t(`hr.reports.col.${c}` as MessageKey)),
  );
  protected readonly monthHeads = computed(() =>
    Array.from({ length: 12 }, (_, i) =>
      this.text.monthShort(`${this.shownYear()}-${String(i + 1).padStart(2, '0')}`),
    ),
  );

  protected readonly monthRows = computed(() =>
    (this.data()?.rows ?? []).map((row) => ({
      id: row.person.employeeId,
      name: row.person.displayName ?? '',
      position: row.person.position ?? '',
      cells: MONTH_COLUMNS.map((c) => {
        const v = monthValue(row, c);
        return c === 'vacationLeft' && v < 0
          ? {
              text: this.text.t('hr.reports.overValue', { n: this.text.number(-v) }),
              zero: false,
              warn: true,
            }
          : { text: this.text.number(v), zero: v === 0, warn: false };
      }),
    })),
  );
  protected readonly monthTotals = computed(() => {
    const rows = this.data()?.rows ?? [];
    return MONTH_COLUMNS.map((c) =>
      c === 'vacationLeft' ? '' : this.text.number(rows.reduce((s, r) => s + monthValue(r, c), 0)),
    );
  });

  protected readonly yearRows = computed(() =>
    (this.data()?.yearRows ?? []).map((row) => {
      const absences = row.months.reduce((s, m) => s + m.absenceDays, 0);
      const vac = row.vacation;
      return {
        id: row.person.employeeId,
        name: row.person.displayName ?? '',
        cells: row.months.map((m) => ({
          planned: this.text.number(m.plannedDays),
          absence: m.absenceDays ? `−${this.text.number(m.absenceDays)}` : '0',
          future: m.isFuture,
        })),
        planned: this.text.number(row.totals.plannedDays),
        absence: `−${this.text.number(absences)}`,
        vacation: this.text.t(vac.over > 0 ? 'hr.team.vacationOver' : 'hr.team.vacationValue', {
          used: this.text.number(vac.used),
          limit: this.text.number(vac.limit),
          over: this.text.number(vac.over),
        }),
        vacationOver: vac.over > 0,
      };
    }),
  );

  protected readonly empty = computed(() => {
    const d = this.data();
    if (!d) return false;
    return this.mode() === 'year' ? !d.yearRows?.length : !d.rows?.length;
  });

  protected readonly errorCode = computed(() => {
    const error = this.report.error();
    return error instanceof KolssApiError ? error.code : 'network_error';
  });

  protected setOffice(office: string): void {
    this.navigate({ office });
  }

  protected setMode(period: HrReportPeriod): void {
    this.navigate({
      period: period === 'month' ? null : period,
      at: period === 'year' ? String(this.shownYear()) : this.shownMonth(),
    });
  }

  protected step(delta: number): void {
    this.navigate({
      at:
        this.mode() === 'year'
          ? String(this.shownYear() + delta)
          : shiftMonth(this.shownMonth(), delta),
    });
  }

  protected goCurrent(): void {
    this.navigate({ at: null });
  }

  protected async exportCsv(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      const query =
        this.mode() === 'year'
          ? { officeId: this.officeId(), period: 'year' as const, year: this.shownYear() }
          : { officeId: this.officeId(), period: 'month' as const, month: this.shownMonth() };
      const blob = await this.hr.exportReport(query, this.text.locale());
      const view = this.document.defaultView;
      if (!view) return;
      const url = view.URL.createObjectURL(blob);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = `kolss-hr-${this.mode()}-${this.mode() === 'year' ? this.shownYear() : this.shownMonth()}.csv`;
      link.click();
      view.URL.revokeObjectURL(url);
    } catch {
      this.toast.show(this.text.t('hr.reports.exportError'));
    } finally {
      this.exporting.set(false);
    }
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }
}
