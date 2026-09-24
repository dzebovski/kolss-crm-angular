import type { Lead, LeadEvent } from '@domain/lead.types';
import type { V2LeadTask } from './lead-card-status';
import type { V2LeadDisplayStatus } from './lead-view.types';

export type V2SuggestionTitle =
  | 'makeCall'
  | 'callAgain'
  | 'scheduledCall'
  | 'followUp'
  | 'showroomMeeting'
  | 'planNextStep'
  | 'noAction'
  | 'projectCreated';

export type V2SuggestionCaption =
  | { readonly kind: 'created'; readonly at: string }
  | { readonly kind: 'lastCall'; readonly at: string }
  | { readonly kind: 'lost' }
  | { readonly kind: 'project' };

export interface V2ActionSuggestion {
  readonly title: V2SuggestionTitle;
  /** `On:` date of the next follow-up; null when none is planned. */
  readonly on: string | null;
  readonly overdue: boolean;
  readonly caption: V2SuggestionCaption;
  /** Lost: the title is `muted`. */
  readonly quiet: boolean;
}

const TITLE_BY_STATUS: Partial<Record<V2LeadDisplayStatus, V2SuggestionTitle>> = {
  noanswer: 'callAgain',
  later: 'scheduledCall',
  success: 'followUp',
  thinking: 'followUp',
  invited: 'showroomMeeting',
};

/**
 * Action panel suggestion (lead card v1.3 and design system ActionPanel): what to do next,
 * when (`On:` = the nearest status reminder, red when overdue) and how fresh the last call is.
 */
export function v2ActionSuggestion(
  lead: Lead,
  status: V2LeadDisplayStatus,
  tasks: readonly V2LeadTask[],
  now: Date,
): V2ActionSuggestion {
  if (status === 'project') {
    return {
      title: 'projectCreated',
      on: null,
      overdue: false,
      caption: { kind: 'project' },
      quiet: false,
    };
  }
  if (status === 'lost') {
    return { title: 'noAction', on: null, overdue: false, caption: { kind: 'lost' }, quiet: true };
  }
  const lastCall = latestCall(lead.events);
  const caption: V2SuggestionCaption = lastCall
    ? { kind: 'lastCall', at: lastCall.occurredAt }
    : { kind: 'created', at: lead.sourceCreatedAt };
  if (!lastCall && status === 'new') {
    return { title: 'makeCall', on: null, overdue: false, caption, quiet: false };
  }
  // Comment reminders are notes, not the lead's next step (design `followup` tasks).
  const next = tasks.find((task) => task.kind !== 'comment') ?? null;
  let title = TITLE_BY_STATUS[status] ?? 'makeCall';
  if (!next && status !== 'noanswer') title = 'planNextStep';
  return {
    title,
    on: next?.dueAt ?? null,
    overdue: next ? new Date(next.dueAt).getTime() < now.getTime() : false,
    caption,
    quiet: false,
  };
}

function latestCall(events: readonly LeadEvent[]): LeadEvent | null {
  let latest: LeadEvent | null = null;
  for (const event of events) {
    if (event.category !== 'call_status') continue;
    if (!latest || event.occurredAt > latest.occurredAt) latest = event;
  }
  return latest;
}

/**
 * `datetime-local` value (`2026-09-26T12:00`, the viewer's time, as v2 shows dates) → ISO for
 * the API. Null when empty or invalid.
 */
export function v2LocalDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hours, minutes] = match.map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO → `datetime-local` value in the viewer's time; empty for null. */
export function v2IsoToLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

// Thousands may be split by a space, a no-break space or a narrow no-break space.
const BUDGET_NUMBER = '[0-9]+(?:[ \\u00A0\\u202F][0-9]{3})*(?:[.,][0-9]{1,2})?';
const BUDGET_TEXT = new RegExp(`^(${BUDGET_NUMBER})(?:\\s*[-–—]\\s*(${BUDGET_NUMBER}))?$`);

/**
 * Budget as the API accepts it (contract §3.7): one number or a range, up to 60 characters, the
 * upper bound not below the lower one. Empty is allowed (no budget).
 */
export function isV2BudgetText(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if ([...text].length > 60) return false;
  const match = BUDGET_TEXT.exec(text);
  if (!match) return false;
  if (!match[2]) return true;
  const number = (part: string) => Number(part.replace(/[ \u00A0\u202F]/g, '').replace(',', '.'));
  return number(match[2]) >= number(match[1]);
}
