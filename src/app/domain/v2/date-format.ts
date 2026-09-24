import type { LocaleCode } from '@domain/i18n.types';

/**
 * CRM v2 date rules from the KOLSS CRM design system README ("Dates") and the
 * reference helpers of lead card v1.3 (`fDate`, `fRem`, `fTime`, `relTime`, `rel`).
 * Pure: the caller passes `now`; calendar days are compared in the viewer's local time.
 * Numeric dates keep the design's `/` separator in every locale; weekday/month names
 * and relative phrases are localized through Intl.
 */

export type V2DateInput = Date | string;

const DAY_MS = 86_400_000;
/** Dates closer than this many calendar days (back or forward) show the weekday. */
const WEEKDAY_WINDOW_DAYS = 7;
/** Recency switches from days to months after this many days. */
const MAX_DAYS_BEFORE_MONTHS = 31;

/** Intl locales for weekday/month names; `en-US` gives the design's `Sep` (en-GB gives `Sept`). */
const NAME_LOCALE: Record<LocaleCode, string> = { en: 'en-US', uk: 'uk-UA', pl: 'pl-PL' };

/** Cards and timeline: `Sat 26 Sep` · `12 Sep` · `15/08` · `15/08/2025`. */
export function formatV2CardDate(value: V2DateInput, now: Date, locale: LocaleCode): string {
  const date = toDate(value);
  if (isWithinWeekdayWindow(date, now)) return weekdayDayMonth(date, locale);
  if (isSameMonth(date, now)) return dayMonth(date, locale);
  if (date.getFullYear() === now.getFullYear())
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
  return formatV2ReportDate(date);
}

/** Reminders and notifications: `Sat 26 Sep` · `30 Sep 2026` · `31/12/2026`. */
export function formatV2ReminderDate(value: V2DateInput, now: Date, locale: LocaleCode): string {
  const date = toDate(value);
  if (isWithinWeekdayWindow(date, now)) return weekdayDayMonth(date, locale);
  if (isSameMonth(date, now)) return `${dayMonth(date, locale)} ${date.getFullYear()}`;
  return formatV2ReportDate(date);
}

/** Reports and exports: always `11/07/2026`. */
export function formatV2ReportDate(value: V2DateInput): string {
  const date = toDate(value);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** 24-hour time: `12:00`. */
export function formatV2Time(value: V2DateInput): string {
  const date = toDate(value);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Time range with an en dash: `12:00–13:00`. */
export function formatV2TimeRange(start: V2DateInput, end: V2DateInput): string {
  return `${formatV2Time(start)}–${formatV2Time(end)}`;
}

/**
 * Recency: `35 min ago` (at least 1), `2 hrs ago` while on the same calendar day,
 * then calendar days: `1 day ago`, `5 days ago`, and months after 31 days: `1 month ago`.
 */
export function formatV2RelativeTime(value: V2DateInput, now: Date, locale: LocaleCode): string {
  const date = toDate(value);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 60) {
    const shown = Math.max(minutes, 1);
    // Intl renders `1 min. ago` / `2 hr ago` in English; the design copy is `1 min ago` / `2 hrs ago`.
    if (locale === 'en') return `${shown} min ago`;
    return relative(locale, 'short').format(-shown, 'minute');
  }

  const daysAgo = -calendarDayDiff(date, now);
  if (daysAgo < 1) {
    const hours = Math.round(minutes / 60);
    if (locale === 'en') return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
    return relative(locale, 'short').format(-hours, 'hour');
  }
  return daysOrMonthsAgo(date, now, daysAgo, locale);
}

/** Day-level recency for the lead card meta row: `Today` · `Yesterday` · `3 days ago`. */
export function formatV2DayRecency(value: V2DateInput, now: Date, locale: LocaleCode): string {
  const date = toDate(value);
  const daysAgo = -calendarDayDiff(date, now);
  if (daysAgo <= 0) return capitalize(relative(locale, 'long', 'auto').format(0, 'day'));
  if (daysAgo === 1) return capitalize(relative(locale, 'long', 'auto').format(-1, 'day'));
  return daysOrMonthsAgo(date, now, daysAgo, locale);
}

/** `N days ago` up to 31 days, then whole calendar months: `1 month ago`, `2 months ago` (user rule 2026-09-24). */
function daysOrMonthsAgo(date: Date, now: Date, daysAgo: number, locale: LocaleCode): string {
  if (daysAgo <= MAX_DAYS_BEFORE_MONTHS) return relative(locale, 'long').format(-daysAgo, 'day');
  return relative(locale, 'long').format(-Math.max(wholeMonthsBetween(date, now), 1), 'month');
}

function wholeMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/** Whole calendar days from `now`'s date to `date`'s date (negative = past). */
export function calendarDayDiff(date: Date, now: Date): number {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((day - today) / DAY_MS);
}

function isWithinWeekdayWindow(date: Date, now: Date): boolean {
  return Math.abs(calendarDayDiff(date, now)) < WEEKDAY_WINDOW_DAYS;
}

function isSameMonth(date: Date, now: Date): boolean {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function weekdayDayMonth(date: Date, locale: LocaleCode): string {
  const parts = nameFormat(locale, true).formatToParts(date);
  return `${part(parts, 'weekday')} ${date.getDate()} ${part(parts, 'month')}`;
}

function dayMonth(date: Date, locale: LocaleCode): string {
  return `${date.getDate()} ${part(nameFormat(locale, false).formatToParts(date), 'month')}`;
}

function part(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value ?? '';
}

const nameFormats = new Map<string, Intl.DateTimeFormat>();
function nameFormat(locale: LocaleCode, withWeekday: boolean): Intl.DateTimeFormat {
  const key = `${locale}|${withWeekday}`;
  let format = nameFormats.get(key);
  if (!format) {
    // Formatting with a day keeps the month in the grammatical form used next to a number.
    format = new Intl.DateTimeFormat(NAME_LOCALE[locale], {
      ...(withWeekday ? { weekday: 'short' } : {}),
      day: 'numeric',
      month: 'short',
    });
    nameFormats.set(key, format);
  }
  return format;
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();
function relative(
  locale: LocaleCode,
  style: Intl.RelativeTimeFormatStyle,
  numeric: Intl.RelativeTimeFormatNumeric = 'always',
): Intl.RelativeTimeFormat {
  const key = `${locale}|${style}|${numeric}`;
  let format = relativeFormats.get(key);
  if (!format) {
    format = new Intl.RelativeTimeFormat(NAME_LOCALE[locale], { style, numeric });
    relativeFormats.set(key, format);
  }
  return format;
}

function toDate(value: V2DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
