import { isOfficeId } from '@core/office/office.config';
import type { LeadReminderKind } from '@domain/lead.rules';
import type { OfficeId } from '@domain/office.types';

/**
 * The three reminder groups the morning digest (Telegram/Slack) links into,
 * mapped onto the canonical `LeadReminderKind` taxonomy (`@domain/lead.rules`).
 * `visit` maps to no reminder-chip kind at all: showroom/measurement visits
 * never render as reminder chips, only as appointment cards (see
 * `calendar-page.ts`'s `remindersByDate`), so a `visit` deep link filters
 * appointments instead of reminders.
 */
export type CalendarReminderFilterKind = 'callback' | 'visit' | 'reminder';

const REMINDER_FILTER_KINDS = new Set<CalendarReminderFilterKind>([
  'callback',
  'visit',
  'reminder',
]);

/** Which `LeadReminderKind`s a business filter group covers. */
export const CALENDAR_REMINDER_FILTER_KIND_MAP: Record<
  CalendarReminderFilterKind,
  readonly LeadReminderKind[]
> = {
  callback: ['callback'],
  visit: [],
  reminder: ['comment', 'thinking'],
};

/**
 * Deep-link state the digest carries into the calendar, e.g.
 * `/crm/calendar?office=kyiv&date=2026-08-17&kind=callback` (day + kind
 * groups) or `/crm/calendar?office=warsaw&due=overdue` (overdue, no date).
 */
export interface CalendarPageQueryState {
  /** Office *code*; `null` = no office param (or one the caller can't see). */
  readonly office: OfficeId | null;
  readonly date: string | null;
  readonly kind: CalendarReminderFilterKind | null;
  /** `due=overdue` — every unfinished reminder due before today, any day. */
  readonly due: boolean;
}

/** Every param this page owns — also the probe set for "is this a filter deep link?". */
const QUERY_KEYS = ['office', 'date', 'kind', 'due'] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OVERDUE = 'overdue';

export interface ReadonlyParamMap {
  get(name: string): string | null;
}

function isCalendarReminderFilterKind(value: unknown): value is CalendarReminderFilterKind {
  return (
    typeof value === 'string' && REMINDER_FILTER_KINDS.has(value as CalendarReminderFilterKind)
  );
}

function parseOffice(value: string | null): OfficeId | null {
  return isOfficeId(value) ? value : null;
}

function parseDate(value: string | null): string | null {
  return value && DATE_PATTERN.test(value) ? value : null;
}

function parseKind(value: string | null): CalendarReminderFilterKind | null {
  return isCalendarReminderFilterKind(value) ? value : null;
}

/**
 * Returns `null` when the URL carries none of this page's params, so the
 * caller can leave the calendar's own defaults (today, week view) untouched.
 * Unknown/malformed values are dropped rather than rejected.
 */
export function parseCalendarPageQuery(params: ReadonlyParamMap): CalendarPageQueryState | null {
  if (!QUERY_KEYS.some((key) => params.get(key) !== null)) return null;

  return {
    office: parseOffice(params.get('office')),
    date: parseDate(params.get('date')),
    kind: parseKind(params.get('kind')),
    due: params.get('due') === OVERDUE,
  };
}

/** Unset fields are omitted so an unfiltered calendar view keeps a clean URL. */
export function serializeCalendarPageQuery(state: CalendarPageQueryState): Record<string, string> {
  const params: Record<string, string> = {};
  if (state.office) params['office'] = state.office;
  if (state.date) params['date'] = state.date;
  if (state.kind) params['kind'] = state.kind;
  if (state.due) params['due'] = OVERDUE;
  return params;
}
