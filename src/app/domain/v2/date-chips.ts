/**
 * Quick date/time chips (Popup-rules.dc.html spec: "In 2 hours · Tomorrow 10:00 · next Mon
 * 10:00 · In a week"; exact source Create-lead.dc.html script `QUICK` + `dayLabel`). Pure: the
 * caller passes `now` (the viewer's local clock, `V2_NOW` in the app) so this is deterministic
 * and testable. `at` is a full Date; the UI formats the label (fixed phrases for in2h/tomorrow/
 * inWeek per the board, `formatV2CardDate` + `formatV2Time` for nextMonday, since it's always
 * within the ±7-day weekday window date-format.ts already renders as "Mon 28 Sep").
 */

export type V2QuickDateChipKey = 'in2h' | 'tomorrow' | 'nextMonday' | 'inWeek';

export interface V2QuickDateChip {
  readonly key: V2QuickDateChipKey;
  readonly at: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const QUICK_HOUR = 10;

function atTime(base: Date, daysAhead: number, hour: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysAhead, hour, 0, 0, 0);
}

/** Days from `now` to the next Monday, always in the future (today counts as 7 away, not 0). */
function daysUntilNextMonday(now: Date): number {
  return ((8 - now.getDay()) % 7 || 7) as number;
}

export function v2QuickDateChips(now: Date): readonly V2QuickDateChip[] {
  return [
    { key: 'in2h', at: new Date(now.getTime() + 2 * HOUR_MS) },
    { key: 'tomorrow', at: atTime(now, 1, QUICK_HOUR) },
    { key: 'nextMonday', at: atTime(now, daysUntilNextMonday(now), QUICK_HOUR) },
    { key: 'inWeek', at: atTime(now, 7, QUICK_HOUR) },
  ];
}

/** Popup-rules "Validation" past-time rule: `d < NOW` → "This time has already passed…". */
export function v2IsPastDateTime(value: Date, now: Date): boolean {
  return value.getTime() < now.getTime();
}
