import type {
  HrCalendar,
  HrCell,
  HrCellAbsence,
  HrDayTotal,
  HrEmployee,
  HrOffice,
} from '@core/api/generated/kolss-api.types';
import { isoWeekday, monthOf, timeToMinutes } from './hr-dates';

export function hrCellKey(employeeId: string, date: string): string {
  return `${employeeId}|${date}`;
}

export function indexHrCells(cells: readonly HrCell[]): Map<string, HrCell> {
  return new Map(cells.map((cell) => [hrCellKey(cell.employeeId, cell.date), cell]));
}

export function indexHrDays(days: readonly HrDayTotal[]): Map<string, HrDayTotal> {
  return new Map(days.map((day) => [day.date, day]));
}

/**
 * What a 44×44 day cell shows (HR-components.dc.html, Day cell):
 * - `closed`: holiday / office closed (icon), or the office does not open that weekday;
 * - `absence`: a full-day absence chip, or `half` for a half day over the planned hours;
 * - `hours`: planned hours (flexible `10` over `–14`, fixed `8h`);
 * - `off`: not working (`–`).
 */
export type HrCellKind = 'closed' | 'absence' | 'hours' | 'off';

export interface HrCellView {
  readonly date: string;
  readonly kind: HrCellKind;
  readonly holiday: boolean;
  readonly absence: HrCellAbsence | null;
  readonly half: 'first_half' | 'second_half' | null;
  readonly start: string | null;
  readonly end: string | null;
  readonly minutes: number;
  readonly makeup: boolean;
  readonly flexible: boolean;
  readonly today: boolean;
  readonly past: boolean;
  /** In a month before `today`'s month (closed for everyone but the super admin). */
  readonly closedMonth: boolean;
}

export function hrCellView(
  date: string,
  cell: HrCell | undefined,
  day: HrDayTotal | undefined,
  employee: Pick<HrEmployee, 'pattern'>,
  today: string,
): HrCellView {
  const holiday = !!day?.holidayKind;
  const closedOffice = holiday || day?.isOpen === false;
  const absence = cell?.absence ?? null;
  const minutes = cell?.plannedMinutes ?? 0;
  let kind: HrCellKind;
  if (closedOffice) kind = 'closed';
  else if (absence) kind = 'absence';
  else if (minutes > 0) kind = 'hours';
  else kind = 'off';
  return {
    date,
    kind,
    holiday,
    absence: closedOffice ? null : absence,
    half: absence && absence.part !== 'full_day' ? absence.part : null,
    start: cell?.plannedStart ?? null,
    end: cell?.plannedEnd ?? null,
    minutes,
    makeup: cell?.isMakeup ?? false,
    flexible: employee.pattern?.kind === 'flexible',
    today: date === today,
    past: date < today,
    closedMonth: monthOf(date) < monthOf(today),
  };
}

export interface HrTodayStrip {
  readonly inOffice: number;
  readonly total: number;
  readonly present: readonly HrEmployee[];
  readonly absent: readonly { readonly employee: HrEmployee; readonly absence: HrCellAbsence }[];
}

/** "In the office today X of N" with avatars and the "Absent today" chips. */
export function hrTodayStrip(calendar: HrCalendar): HrTodayStrip {
  const cells = indexHrCells(calendar.cells);
  const present: HrEmployee[] = [];
  const absent: { employee: HrEmployee; absence: HrCellAbsence }[] = [];
  for (const person of calendar.people) {
    const cell = cells.get(hrCellKey(person.id, calendar.today));
    if (cell?.absence) absent.push({ employee: person, absence: cell.absence });
    if (cell && cell.officeDays > 0 && cell.absence?.type !== 'remote') present.push(person);
  }
  return { inOffice: present.length, total: calendar.people.length, present, absent };
}

export interface HrInterval {
  readonly start: number;
  readonly end: number;
}

/** Minutes of the planned interval that are spent in the office (remote and full-day absence: none). */
export function hrOfficeInterval(cell: HrCell): HrInterval | null {
  const start = timeToMinutes(cell.plannedStart);
  const end = timeToMinutes(cell.plannedEnd);
  if (start === null || end === null || end <= start || !cell.isWorkday) return null;
  const absence = cell.absence;
  if (!absence) return { start, end };
  if (absence.part === 'full_day' || absence.type === 'remote') return null;
  const middle = start + Math.round((end - start) / 2);
  return absence.part === 'first_half' ? { start: middle, end } : { start, end: middle };
}

/** Length of the union of intervals clipped to `[open, close]`. */
export function hrCoveredMinutes(
  intervals: readonly HrInterval[],
  open: number,
  close: number,
): number {
  const clipped = intervals
    .map((i) => ({ start: Math.max(i.start, open), end: Math.min(i.end, close) }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let cursorEnd = -1;
  for (const i of clipped) {
    if (i.start >= cursorEnd) {
      total += i.end - i.start;
      cursorEnd = i.end;
    } else if (i.end > cursorEnd) {
      total += i.end - cursorEnd;
      cursorEnd = i.end;
    }
  }
  return total;
}

export interface HrOfficeDayHours {
  readonly open: number;
  readonly close: number;
}

export function hrOfficeHoursOn(office: HrOffice, date: string): HrOfficeDayHours | null {
  const hours = office.hours.find((h) => h.weekday === isoWeekday(date));
  const open = timeToMinutes(hours?.opens);
  const close = timeToMinutes(hours?.closes);
  return open === null || close === null || close <= open ? null : { open, close };
}

/** Week view footer "Hours covered: X of Y h" for one day (remote does not count). */
export function hrDayCoverage(
  calendar: Pick<HrCalendar, 'office' | 'cells'>,
  date: string,
): { readonly covered: number; readonly open: number } | null {
  const hours = hrOfficeHoursOn(calendar.office, date);
  if (!hours) return null;
  const intervals = calendar.cells
    .filter((cell) => cell.date === date)
    .map(hrOfficeInterval)
    .filter((i): i is HrInterval => i !== null);
  return {
    covered: hrCoveredMinutes(intervals, hours.open, hours.close),
    open: hours.close - hours.open,
  };
}

/** Earliest opening and latest closing over the week, for the shared hour axis. */
export function hrWeekAxis(office: HrOffice): HrOfficeDayHours {
  let open = 24 * 60;
  let close = 0;
  for (const h of office.hours) {
    const o = timeToMinutes(h.opens);
    const c = timeToMinutes(h.closes);
    if (o === null || c === null) continue;
    open = Math.min(open, o);
    close = Math.max(close, c);
  }
  return close > open ? { open, close } : { open: 9 * 60, close: 18 * 60 };
}
