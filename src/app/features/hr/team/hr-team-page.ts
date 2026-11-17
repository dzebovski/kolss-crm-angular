import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { HrTeamRow } from '@core/api/generated/kolss-api.types';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { hrCellView } from '@domain/hr/hr-calendar';
import { shiftMonth } from '@domain/hr/hr-dates';
import { hrName } from '@domain/hr/hr-entry';
import { HrService } from '@services/hr/hr.service';
import { V2Button } from '../../v2/ui/v2-button';
import { V2Select, type V2SelectOption } from '../../v2/ui/v2-select';
import { V2StatePanel } from '../../v2/ui/v2-state-panel';
import { HrDialogs } from '../dialogs/hr-dialogs';
import { HrSession } from '../hr-session';
import { HrText } from '../hr-text';
import { HrAbsenceChip } from '../ui/hr-absence-chip';
import { HrAvatar } from '../ui/hr-avatar';

const ALL = 'all';

// Team (HR-team / -empty / -loading.dc.html, super admin): 9 columns, office / search / month
// filters, rows open the employee page. Query params: `office` (`all` by default), `month`.
@Component({
  selector: 'app-hr-team-page',
  imports: [HrAbsenceChip, HrAvatar, RouterLink, TranslatePipe, V2Button, V2Select, V2StatePanel],
  templateUrl: './hr-team-page.html',
  styleUrl: './hr-team-page.scss',
})
export class HrTeamPage {
  private readonly hr = inject(HrService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(HrDialogs);
  protected readonly session = inject(HrSession);
  protected readonly text = inject(HrText);

  readonly office = input<string>();
  readonly month = input<string>();

  protected readonly query = signal('');
  protected readonly showUntracked = signal(false);

  protected readonly officeId = computed(() => this.office() || ALL);
  protected readonly shownMonth = computed(() => {
    const month = this.month();
    if (month && /^\d{4}-\d{2}$/.test(month)) return month;
    return this.session.value()?.month ?? '';
  });

  protected readonly team = resource({
    params: () => {
      const month = this.shownMonth();
      if (!month) return undefined;
      return {
        month,
        officeId: this.officeId() === ALL ? undefined : this.officeId(),
        includeUntracked: this.showUntracked(),
        version: this.hr.changes(),
      };
    },
    loader: ({ params }) =>
      this.hr.team({
        month: params.month,
        officeId: params.officeId,
        includeUntracked: params.includeUntracked,
      }),
  });

  protected readonly officeOptions = computed<V2SelectOption[]>(() => [
    { value: ALL, label: this.text.t('hr.team.allOffices') },
    ...this.session.offices().map((office) => ({
      value: office.id,
      label: this.text.officeName(office),
    })),
  ]);

  protected readonly data = computed(() => (this.team.hasValue() ? this.team.value() : undefined));

  protected readonly rows = computed(() => {
    const data = this.data();
    if (!data) return [];
    const q = this.query().trim().toLocaleLowerCase();
    return data.items
      .filter((row) => !q || hrName(row.employee).toLocaleLowerCase().includes(q))
      .map((row) => this.toRow(row, data.today));
  });

  protected readonly trackedCount = computed(
    () => this.data()?.items.filter((row) => row.employee.isTracked).length ?? 0,
  );

  protected readonly errorCode = computed(() => {
    const error = this.team.error();
    return error instanceof KolssApiError ? error.code : 'network_error';
  });

  private toRow(row: HrTeamRow, today: string) {
    const employee = row.employee;
    const view = row.today ? hrCellView(today, row.today, undefined, employee, today) : null;
    const vacation = row.vacation;
    return {
      id: employee.id,
      name: hrName(employee),
      position: employee.position ?? '',
      tracked: employee.isTracked,
      office: this.officeLabel(employee.officeId, employee.officeCode),
      schedule: this.text.schedule(employee.pattern),
      todayAbsence: view?.kind === 'absence' ? view.absence : null,
      todayText:
        view?.kind === 'hours'
          ? this.text.range(view.start, view.end)
          : view?.kind === 'absence'
            ? ''
            : this.text.t('hr.team.dayOff'),
      todayOff: !view || view.kind === 'off' || view.kind === 'closed',
      month: this.text.t('hr.team.monthValue', {
        d: this.text.number(row.month.plannedDays),
        h: this.text.number(row.month.plannedHours),
      }),
      absences: row.absences,
      vacation: this.text.t(vacation.over > 0 ? 'hr.team.vacationOver' : 'hr.team.vacationValue', {
        used: this.text.number(vacation.used),
        limit: this.text.number(vacation.limit),
        over: this.text.number(vacation.over),
      }),
      vacationOver: vacation.over > 0,
      makeup: row.makeupOwed > 0 ? this.text.plural('hr.n.days', row.makeupOwed) : '–',
      next: row.nextWeek,
    };
  }

  private officeLabel(id: string, code: string): string {
    const office = this.session.offices().find((o) => o.id === id);
    return office ? this.text.officeName(office) : code;
  }

  protected setOffice(officeId: string): void {
    this.navigate({ office: officeId === ALL ? null : officeId });
  }

  protected step(delta: number): void {
    this.navigate({ month: shiftMonth(this.shownMonth(), delta) });
  }

  protected addToTracking(): void {
    this.dialogs.addToTracking();
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }
}
