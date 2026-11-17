// Calendar-date helpers of the HR portal. Every date is an ISO `YYYY-MM-DD` string in the
// office's own calendar (the API sends `today` in the office time zone), so the math runs in
// UTC and never depends on the browser's zone. Months are `YYYY-MM`.

const DAY_MS = 86_400_000;

function toUtc(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(iso: string): number {
  const day = new Date(toUtc(iso)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

export function monthEnd(month: string): string {
  return addDays(monthStart(shiftMonth(month, 1)), -1);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Every date from `from` to `to`, both included. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) out.push(day);
  return out;
}

export function monthDates(month: string): string[] {
  return dateRange(monthStart(month), monthEnd(month));
}

/**
 * Monday-first weeks covering the month; days of the neighbouring months are `null`, so the
 * grid keeps its columns.
 */
export function monthWeeks(month: string): (string | null)[][] {
  const dates = monthDates(month);
  const lead = isoWeekday(dates[0]) - 1;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A Date at noon UTC of the ISO day, for `Intl.DateTimeFormat` with `timeZone: 'UTC'`. */
export function isoToDate(iso: string): Date {
  return new Date(toUtc(iso) + DAY_MS / 2);
}

/** `HH:MM` (or `HH:MM:SS`) → minutes after midnight; `null` when not a time. */
export function timeToMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? '');
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `HH:MM` options from `from` to `to`, both included, every `step` minutes. */
export function timeOptions(from: string, to: string, step = 30): string[] {
  const start = timeToMinutes(from);
  const end = timeToMinutes(to);
  if (start === null || end === null) return [];
  const out: string[] = [];
  for (let t = start; t <= end; t += step) out.push(minutesToTime(t));
  return out;
}

/** Short hour label as on the boards: `10`, `10:30`. */
export function shortTime(value: string | null | undefined): string {
  const minutes = timeToMinutes(value);
  if (minutes === null) return '';
  return minutes % 60 === 0 ? String(minutes / 60) : minutesToTime(minutes).replace(/^0/, '');
}

/** Hours with at most one decimal: 240 → `4`, 270 → `4.5`. */
export function hoursLabel(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10);
}

/** Days with half steps: 1 → `1`, 0.5 → `0.5`. */
export function daysLabel(days: number): string {
  return String(Math.round(days * 2) / 2);
}
