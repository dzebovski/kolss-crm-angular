import type {
  HrOffice,
  HrPattern,
  HrPatternKind,
  HrPatternRequest,
} from '@core/api/generated/kolss-api.types';
import { addDays, mondayOf, timeToMinutes } from './hr-dates';

/** Editable schedule pattern (HR-schedule-editor.dc.html, HR-add-to-tracking.dc.html). */
export interface HrPatternDraft {
  readonly kind: HrPatternKind;
  readonly weekdays: readonly number[];
  readonly start: string;
  readonly end: string;
  /** Text of the "Hours per day" input; empty = auto from start / end (fixed). */
  readonly hoursPerDay: string;
  readonly daysPerWeek: number;
}

export interface HrPatternErrors {
  readonly weekdays?: 'required';
  readonly end?: 'end_before_start';
  /** ISO weekday where start / end leave the office hours. */
  readonly outsideDay?: number;
  readonly hoursPerDay?: 'range';
  readonly daysPerWeek?: 'range';
}

/** Monday after `today` — the default "Valid from". */
export function hrNextMonday(today: string): string {
  return addDays(mondayOf(today), 7);
}

/** Weekdays the office is open (closed days can't be picked). */
export function hrOpenWeekdays(office: Pick<HrOffice, 'hours'>): number[] {
  return office.hours
    .filter((h) => !!h.opens && !!h.closes)
    .map((h) => h.weekday)
    .sort((a, b) => a - b);
}

/** Draft from the current pattern, else Mon–Fri 10:00–18:00. */
export function hrPatternDraft(pattern: HrPattern | null | undefined): HrPatternDraft {
  if (pattern) {
    return {
      kind: pattern.kind,
      weekdays: pattern.kind === 'fixed' ? [...pattern.weekdays] : [1, 2, 3, 4, 5],
      start: pattern.startTime?.slice(0, 5) ?? '10:00',
      end: pattern.endTime?.slice(0, 5) ?? '18:00',
      hoursPerDay: String(pattern.hoursPerDay),
      daysPerWeek: pattern.daysPerWeek,
    };
  }
  return {
    kind: 'fixed',
    weekdays: [1, 2, 3, 4, 5],
    start: '10:00',
    end: '18:00',
    hoursPerDay: '8',
    daysPerWeek: 5,
  };
}

/** Hours between start and end (the auto value of "Hours per day"). */
export function hrSpanHours(start: string, end: string): number | null {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return s === null || e === null || e <= s ? null : (e - s) / 60;
}

function parseHours(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(n) ? n : null;
}

/** Hours per day the draft saves (fixed: typed value, else the span). */
export function hrDraftHours(draft: HrPatternDraft): number | null {
  const typed = parseHours(draft.hoursPerDay);
  if (typed !== null) return typed;
  return draft.kind === 'fixed' ? hrSpanHours(draft.start, draft.end) : null;
}

/** Same rules as the API (`hrValidatePattern`). */
export function validateHrPattern(
  draft: HrPatternDraft,
  office: Pick<HrOffice, 'hours'>,
): HrPatternErrors {
  const errors: { -readonly [K in keyof HrPatternErrors]: HrPatternErrors[K] } = {};
  const hours = hrDraftHours(draft);
  if (hours === null || hours <= 0 || hours > 12 || (hours * 2) % 1 !== 0) {
    errors.hoursPerDay = 'range';
  }
  if (draft.kind === 'flexible') {
    if (draft.daysPerWeek < 1 || draft.daysPerWeek > 6) errors.daysPerWeek = 'range';
    return errors;
  }
  if (draft.weekdays.length === 0) errors.weekdays = 'required';
  const start = timeToMinutes(draft.start);
  const end = timeToMinutes(draft.end);
  if (start === null || end === null || end <= start) {
    errors.end = 'end_before_start';
    return errors;
  }
  for (const weekday of [...draft.weekdays].sort((a, b) => a - b)) {
    const h = office.hours.find((x) => x.weekday === weekday);
    const opens = timeToMinutes(h?.opens);
    const closes = timeToMinutes(h?.closes);
    if (opens === null || closes === null || start < opens || end > closes) {
      errors.outsideDay = weekday;
      break;
    }
  }
  return errors;
}

export function hasHrPatternErrors(errors: HrPatternErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function hrPatternRequest(
  draft: HrPatternDraft,
  validFrom?: string,
  note?: string,
): HrPatternRequest {
  const hoursPerDay = hrDraftHours(draft);
  const base = {
    ...(validFrom ? { validFrom } : {}),
    note: note?.trim() || null,
  };
  if (draft.kind === 'flexible') {
    return { ...base, kind: 'flexible', daysPerWeek: draft.daysPerWeek, hoursPerDay };
  }
  return {
    ...base,
    kind: 'fixed',
    weekdays: [...draft.weekdays].sort((a, b) => a - b),
    startTime: draft.start,
    endTime: draft.end,
    hoursPerDay,
  };
}

/** A pattern-shaped value for the schedule summary (`HrText.schedule`). */
export function hrPatternPreview(draft: HrPatternDraft): HrPattern {
  return {
    id: '',
    validFrom: '',
    validTo: null,
    kind: draft.kind,
    weekdays: [...draft.weekdays].sort((a, b) => a - b),
    startTime: draft.kind === 'fixed' ? draft.start : null,
    endTime: draft.kind === 'fixed' ? draft.end : null,
    daysPerWeek: draft.kind === 'fixed' ? draft.weekdays.length : draft.daysPerWeek,
    hoursPerDay: hrDraftHours(draft) ?? 0,
    note: null,
    createdAt: '',
    createdBy: null,
    createdByName: null,
  };
}

/** Is `date` in a month before `today`'s month (closed for everyone but the super admin)? */
export function hrIsClosedMonth(date: string, today: string): boolean {
  return date.slice(0, 7) < today.slice(0, 7);
}
