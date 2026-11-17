import type { HrCell, HrOffice, HrPattern, HrShiftDay } from '@core/api/generated/kolss-api.types';
import { hrOfficeHoursOn } from './hr-calendar';
import { addDays, minutesToTime, timeToMinutes } from './hr-dates';

/** One column of "Plan my hours" (HR-plan-hours.dc.html), Mon–Sat. */
export interface HrPlanDay {
  readonly date: string;
  readonly start: string;
  readonly end: string;
  readonly makeup: boolean;
}

export type HrPlanDayState =
  'ok' | 'empty' | 'closed' | 'absence' | 'locked' | 'outside' | 'end_before_start';

export const HR_PLAN_DAYS = 6;

/** The six editable days of the week that starts on `monday`, seeded from the API cells. */
export function hrPlanWeek(monday: string, cells: readonly HrCell[]): HrPlanDay[] {
  return Array.from({ length: HR_PLAN_DAYS }, (_, i) => {
    const date = addDays(monday, i);
    const cell = cells.find((c) => c.date === date);
    const start = cell?.shiftKind ? (cell.plannedStart ?? '') : '';
    const end = cell?.shiftKind ? (cell.plannedEnd ?? '') : '';
    return { date, start: start.slice(0, 5), end: end.slice(0, 5), makeup: !!cell?.isMakeup };
  });
}

/**
 * State of a planned day: past / today are locked (hours change from tomorrow on, D17), a
 * closed office or a full-day absence takes no hours, otherwise the times must be inside the
 * office hours and end after start. An unplanned day is `empty`.
 */
export function hrPlanDayState(
  day: HrPlanDay,
  office: HrOffice,
  cell: HrCell | undefined,
  editableFrom: string | null,
  closedDates: ReadonlySet<string>,
): HrPlanDayState {
  if (editableFrom !== null && day.date < editableFrom) return 'locked';
  const hours = hrOfficeHoursOn(office, day.date);
  if (!hours || closedDates.has(day.date)) return 'closed';
  if (cell?.absence?.part === 'full_day') return 'absence';
  const start = timeToMinutes(day.start);
  const end = timeToMinutes(day.end);
  if (start === null && end === null) return 'empty';
  if (start === null || end === null) return 'end_before_start';
  if (end <= start) return 'end_before_start';
  if (start < hours.open || end > hours.close) return 'outside';
  return 'ok';
}

export function hrPlanMinutes(day: HrPlanDay): number {
  const start = timeToMinutes(day.start);
  const end = timeToMinutes(day.end);
  return start !== null && end !== null && end > start ? end - start : 0;
}

export interface HrPlanCounter {
  readonly minutes: number;
  readonly days: number;
  readonly normMinutes: number;
  readonly normDays: number;
  readonly ok: boolean;
}

/** Counter pill "X of 20 h · Y of 5 days"; under or over the norm is shown, not blocked. */
export function hrPlanCounter(
  days: readonly HrPlanDay[],
  pattern: HrPattern | null,
): HrPlanCounter {
  const planned = days.filter((day) => hrPlanMinutes(day) > 0);
  const minutes = planned.reduce((sum, day) => sum + hrPlanMinutes(day), 0);
  const normDays = pattern?.daysPerWeek ?? 0;
  const normMinutes = Math.round(normDays * (pattern?.hoursPerDay ?? 0) * 60);
  return {
    minutes,
    days: planned.length,
    normMinutes,
    normDays,
    ok: minutes === normMinutes && planned.length === normDays,
  };
}

/**
 * Body of `PUT /v1/hr/shifts`: the editable planned days. Locked days are left out (the API
 * keeps them); a cleared editable day is left out too, which removes its shift.
 */
export function hrPlanRequest(
  days: readonly HrPlanDay[],
  editableFrom: string | null,
): HrShiftDay[] {
  return days
    .filter((day) => (editableFrom === null || day.date >= editableFrom) && hrPlanMinutes(day) > 0)
    .map((day) => ({
      date: day.date,
      startTime: day.start,
      endTime: day.end,
      kind: day.makeup ? 'makeup' : 'planned',
    }));
}

/** Default times for a day the person starts planning: office opening + hours per day. */
export function hrPlanDefaultTimes(
  office: HrOffice,
  date: string,
  pattern: HrPattern | null,
): { readonly start: string; readonly end: string } | null {
  const hours = hrOfficeHoursOn(office, date);
  if (!hours) return null;
  const length = Math.round((pattern?.hoursPerDay ?? 4) * 60);
  const end = Math.min(hours.open + length, hours.close);
  return { start: minutesToTime(hours.open), end: minutesToTime(end) };
}
