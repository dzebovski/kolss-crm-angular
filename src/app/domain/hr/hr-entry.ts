import type {
  HrCellAbsenceType,
  HrDayPart,
  HrEmployee,
  HrEntryType,
  HrHoliday,
  HrOffice,
  HrPattern,
} from '@core/api/generated/kolss-api.types';
import { dateRange, isoWeekday, mondayOf, monthOf } from './hr-dates';

/** Types on the Add absence popup, in board order (HR-add-absence.dc.html). */
export const HR_ENTRY_TYPES: readonly HrEntryType[] = [
  'vacation',
  'sick',
  'day_off_unpaid',
  'day_off_makeup',
  'makeup_day',
  'remote',
  'occasional',
  'other',
];

/** Legend order of the calendar (HR-components.dc.html, Legend). */
export const HR_LEGEND_TYPES: readonly (HrCellAbsenceType | 'makeup_day')[] = [
  'vacation',
  'sick',
  'absent',
  'day_off_unpaid',
  'day_off_makeup',
  'makeup_day',
  'remote',
  'occasional',
  'other',
];

export const HR_DAY_PARTS: readonly HrDayPart[] = ['full_day', 'first_half', 'second_half'];

export type HrDateError =
  'hr_past_date' | 'hr_closed_month' | 'hr_end_before_start' | 'hr_hours_past_date';

/**
 * Client copy of the edit window (API `hrEditWindowError`): `editableFrom` is the first date
 * the viewer may change (`null` = super admin, no limit). Absences may start today; hours
 * (and make-up days) only from tomorrow. A date in an earlier month than `today` reports the
 * closed month first, as the API does.
 */
export function hrDateError(
  date: string,
  today: string,
  editableFrom: string | null,
): 'hr_past_date' | 'hr_closed_month' | null {
  if (editableFrom === null) return null;
  if (monthOf(date) < monthOf(today)) return 'hr_closed_month';
  return date < editableFrom ? 'hr_past_date' : null;
}

export interface HrAbsenceDraft {
  readonly type: HrEntryType;
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly part: HrDayPart;
  readonly comment: string;
}

export interface HrAbsenceErrors {
  readonly dateFrom: 'hr_past_date' | 'hr_closed_month' | null;
  readonly dateTo: 'hr_end_before_start' | 'hr_past_date' | 'hr_closed_month' | null;
  readonly comment: 'hr_comment_required' | null;
}

/** Validation of the Add / Edit absence popup, the same rules the API applies. */
export function validateHrAbsence(
  draft: HrAbsenceDraft,
  today: string,
  editableFrom: string | null,
): HrAbsenceErrors {
  const from = draft.dateFrom ? hrDateError(draft.dateFrom, today, editableFrom) : null;
  let to: HrAbsenceErrors['dateTo'] = null;
  if (draft.dateFrom && draft.dateTo && draft.dateTo < draft.dateFrom) to = 'hr_end_before_start';
  else if (draft.dateTo && !from) to = hrDateError(draft.dateTo, today, editableFrom);
  return {
    dateFrom: from,
    dateTo: to,
    comment: draft.type === 'other' && !draft.comment.trim() ? 'hr_comment_required' : null,
  };
}

export function hasHrAbsenceErrors(errors: HrAbsenceErrors): boolean {
  return !!(errors.dateFrom || errors.dateTo || errors.comment);
}

function holidaySet(holidays: readonly HrHoliday[]): Set<string> {
  return new Set(holidays.map((holiday) => holiday.day));
}

function openWeekdays(office: HrOffice): Set<number> {
  return new Set(office.hours.filter((h) => h.opens && h.closes).map((h) => h.weekday));
}

/**
 * Preview of the working days an absence takes (popup summary line). Mirrors `hr_days()`:
 * fixed — pattern weekdays the office is open, minus holidays; flexible — open non-holiday
 * days, at most `daysPerWeek` per ISO week. Half a day for a single-day half absence. The
 * saved entry's `days` from the API is the truth; planned shifts are not subtracted here.
 */
export function hrAbsenceDays(
  draft: Pick<HrAbsenceDraft, 'dateFrom' | 'dateTo' | 'part'>,
  pattern: HrPattern | null,
  office: HrOffice,
  holidays: readonly HrHoliday[],
): number {
  if (!draft.dateFrom || !draft.dateTo || draft.dateTo < draft.dateFrom) return 0;
  const closed = holidaySet(holidays);
  const open = openWeekdays(office);
  const days = dateRange(draft.dateFrom, draft.dateTo).filter(
    (day) => open.has(isoWeekday(day)) && !closed.has(day),
  );
  let count: number;
  if (pattern?.kind === 'flexible') {
    const perWeek = new Map<string, number>();
    for (const day of days) perWeek.set(mondayOf(day), (perWeek.get(mondayOf(day)) ?? 0) + 1);
    count = [...perWeek.values()].reduce((sum, n) => sum + Math.min(n, pattern.daysPerWeek), 0);
  } else {
    const weekdays = new Set(pattern?.weekdays ?? [1, 2, 3, 4, 5]);
    count = days.filter((day) => weekdays.has(isoWeekday(day))).length;
  }
  const single = draft.dateFrom === draft.dateTo;
  return single && draft.part !== 'full_day' ? count * 0.5 : count;
}

/** Initials for the avatar circle: first letters of the first two words. */
export function hrInitials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function hrName(employee: Pick<HrEmployee, 'displayName'> | null | undefined): string {
  return employee?.displayName?.trim() || '—';
}
