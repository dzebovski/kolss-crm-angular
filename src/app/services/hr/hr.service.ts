import { inject, Service, signal } from '@angular/core';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import type {
  CreateHrEmployeeRequest,
  HrAbsenceRequest,
  HrAccount,
  HrCalendar,
  HrCalendarQuery,
  HrEmployeeDetail,
  HrEntriesQuery,
  HrEntry,
  HrHoliday,
  HrHolidayRequest,
  HrMe,
  HrMutation,
  HrOffice,
  HrPattern,
  HrPatternRequest,
  HrReport,
  HrReportQuery,
  HrSettingsRequest,
  HrShiftDay,
  HrTeam,
  HrTeamQuery,
  HrWeekShifts,
  UpdateHrEmployeeRequest,
} from '@core/api/generated/kolss-api.types';

/**
 * Data service of the HR portal: every `/v1/hr/*` endpoint (API 2.45.0). Components never call
 * `KolssApiClient` directly. `changes` ticks after every successful mutation so open screens
 * (calendar, My time, team) reload their data.
 */
@Service()
export class HrService {
  private readonly api = inject(KolssApiClient);
  private readonly version = signal(0);

  /** Increments after each saved change; read it inside a `resource` params to refetch. */
  readonly changes = this.version.asReadonly();

  private async changed<T>(promise: Promise<T>): Promise<T> {
    const result = await promise;
    this.version.update((v) => v + 1);
    return result;
  }

  me(): Promise<HrMe> {
    return this.api.hrMe();
  }

  calendar(query: HrCalendarQuery): Promise<HrCalendar> {
    return this.api.hrCalendar(query);
  }

  async entries(query: HrEntriesQuery): Promise<readonly HrEntry[]> {
    return (await this.api.hrEntries(query)).items;
  }

  createAbsence(body: HrAbsenceRequest): Promise<HrMutation> {
    return this.changed(this.api.createHrAbsence(body));
  }

  updateAbsence(id: string, body: HrAbsenceRequest): Promise<HrMutation> {
    return this.changed(this.api.updateHrAbsence(id, body));
  }

  /** A make-up entry is a shift: it is deleted through the shift endpoint. */
  deleteEntry(entry: Pick<HrEntry, 'id' | 'kind'>): Promise<HrMutation> {
    return this.changed(
      entry.kind === 'makeup'
        ? this.api.deleteHrShift(entry.id)
        : this.api.deleteHrAbsence(entry.id),
    );
  }

  putWeekShifts(
    weekStart: string,
    days: readonly HrShiftDay[],
    employeeId?: string,
  ): Promise<HrWeekShifts> {
    return this.changed(this.api.putHrWeekShifts(weekStart, days, employeeId));
  }

  team(query: HrTeamQuery): Promise<HrTeam> {
    return this.api.hrTeam(query);
  }

  async accounts(): Promise<readonly HrAccount[]> {
    return (await this.api.hrAccounts()).items;
  }

  createEmployee(body: CreateHrEmployeeRequest): Promise<HrEmployeeDetail> {
    return this.changed(this.api.createHrEmployee(body));
  }

  employee(id: string): Promise<HrEmployeeDetail> {
    return this.api.hrEmployee(id);
  }

  updateEmployee(id: string, body: UpdateHrEmployeeRequest): Promise<HrEmployeeDetail> {
    return this.changed(this.api.updateHrEmployee(id, body));
  }

  async createPattern(employeeId: string, body: HrPatternRequest): Promise<readonly HrPattern[]> {
    return (await this.changed(this.api.createHrPattern(employeeId, body))).items;
  }

  putLeaveLimit(employeeId: string, year: number, days: number): Promise<HrEmployeeDetail> {
    return this.changed(this.api.putHrLeaveLimit(employeeId, year, days));
  }

  settings(officeId: string): Promise<HrOffice> {
    return this.api.hrSettings(officeId);
  }

  putSettings(officeId: string, body: HrSettingsRequest): Promise<HrOffice> {
    return this.changed(this.api.putHrSettings(officeId, body));
  }

  async holidays(officeId: string, year: number): Promise<readonly HrHoliday[]> {
    return (await this.api.hrHolidays(officeId, year)).items;
  }

  createHoliday(body: HrHolidayRequest): Promise<HrHoliday> {
    return this.changed(this.api.createHrHoliday(body));
  }

  updateHoliday(id: string, body: HrHolidayRequest): Promise<HrHoliday> {
    return this.changed(this.api.updateHrHoliday(id, body));
  }

  deleteHoliday(id: string): Promise<void> {
    return this.changed(this.api.deleteHrHoliday(id));
  }

  report(query: HrReportQuery): Promise<HrReport> {
    return this.api.hrReport(query);
  }

  exportReport(query: HrReportQuery, lang: string): Promise<Blob> {
    return this.api.exportHrReport(query, lang);
  }
}
