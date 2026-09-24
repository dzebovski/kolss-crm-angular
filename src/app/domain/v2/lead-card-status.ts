import {
  activeRemindersForLead,
  callbackDueAtFromNewValue,
  type LeadReminderKind,
} from '@domain/lead.rules';
import type { Lead, LeadEvent } from '@domain/lead.types';
import type { V2LeadDisplayStatus } from './lead-view.types';

/** Row labels of the Current status card (lead card v1.3, `current.rows`). */
export type V2CurrentStatusLabel =
  | 'attempt'
  | 'nextAttempt'
  | 'callBack'
  | 'call'
  | 'nextAction'
  | 'followUp'
  | 'when'
  | 'designer'
  | 'where'
  | 'reason';

/** A row value; the UI formats dates and resolves people, offices and reasons. */
export type V2CurrentStatusValue =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'dateTime'; readonly at: string }
  | { readonly kind: 'range'; readonly start: string; readonly end: string | null }
  | { readonly kind: 'person'; readonly id: string }
  | { readonly kind: 'office' }
  | { readonly kind: 'lossReason'; readonly code: string }
  | { readonly kind: 'notSet' };

export interface V2CurrentStatusRow {
  readonly label: V2CurrentStatusLabel;
  readonly value: V2CurrentStatusValue;
}

export interface V2CurrentStatus {
  readonly rows: readonly V2CurrentStatusRow[];
  /** Comment of the change that set the status; null when there is none. */
  readonly comment: string | null;
}

/** The v1 event that sets each v2 status (decision D1b mapping). */
const STATUS_EVENT: Partial<
  Record<
    V2LeadDisplayStatus,
    { readonly category: 'call_status' | 'client_status'; readonly code: string }
  >
> = {
  later: { category: 'call_status', code: 'callback_requested' },
  noanswer: { category: 'call_status', code: 'no_answer' },
  success: { category: 'call_status', code: 'reached' },
  thinking: { category: 'client_status', code: 'thinking' },
  invited: { category: 'client_status', code: 'showroom_invited' },
  lost: { category: 'client_status', code: 'closed_lost' },
  measurement_scheduled: { category: 'client_status', code: 'measurement_scheduled' },
  calculation_in_progress: { category: 'client_status', code: 'calculation_in_progress' },
  postponed: { category: 'client_status', code: 'postponed' },
  contract_signed: { category: 'client_status', code: 'contract_signed' },
};

/**
 * Current status card: the details of the change that set the lead's status, as the design's
 * scenarios show them. Values come from that timeline event (v2 details in `new_value`, see the
 * workflow contract), with the lead's own fields as the fallback for older v1 events.
 * Null = "No status yet" (a new lead).
 */
export function v2CurrentStatus(
  lead: Lead,
  status: V2LeadDisplayStatus,
  noAnswerAttempts: number,
): V2CurrentStatus | null {
  if (status === 'new') return null;
  const event = statusEvent(lead.events, status);
  const value = record(event?.newValue);
  const due = callbackDueAtFromNewValue(event?.newValue) ?? lead.callbackDueAt;
  const rows: V2CurrentStatusRow[] = [];
  const add = (label: V2CurrentStatusLabel, row: V2CurrentStatusValue | null) => {
    if (row) rows.push({ label, value: row });
  };

  switch (status) {
    case 'noanswer': {
      const attempt = numberValue(value['attempt']) ?? (noAnswerAttempts || null);
      add('attempt', attempt ? { kind: 'text', text: String(attempt) } : null);
      add('nextAttempt', dateTime(due));
      break;
    }
    case 'later':
      add('callBack', dateTime(due));
      break;
    case 'success':
      add('call', dateTime(event?.occurredAt ?? lead.callStatusChangedAt));
      add('nextAction', textValue(value['next_action']) ?? { kind: 'notSet' });
      add('followUp', dateTime(callbackDueAtFromNewValue(event?.newValue)));
      break;
    case 'thinking':
      add('followUp', dateTime(due));
      break;
    case 'invited': {
      const start = stringValue(value['starts_at']) ?? lead.visit?.scheduledAt ?? null;
      const end = stringValue(value['ends_at']) ?? lead.visit?.endsAt ?? null;
      const designer =
        stringValue(value['designer_id']) ??
        stringValue(value['responsible_manager_id']) ??
        lead.visit?.responsibleManagerId ??
        null;
      add('when', start ? { kind: 'range', start, end } : null);
      add('designer', designer ? { kind: 'person', id: designer } : null);
      add('where', { kind: 'office' });
      break;
    }
    case 'lost': {
      const reason =
        stringValue(value['loss_reason']) ?? stringValue(value['reason']) ?? lead.close?.reason;
      add('reason', reason ? { kind: 'lossReason', code: reason } : null);
      break;
    }
    default:
      break;
  }

  return { rows, comment: event?.comment?.trim() || null };
}

/** Latest event that set the given status. */
function statusEvent(events: readonly LeadEvent[], status: V2LeadDisplayStatus): LeadEvent | null {
  const match = STATUS_EVENT[status];
  if (!match) return null;
  let latest: LeadEvent | null = null;
  for (const event of events) {
    if (event.category !== match.category || event.statusCode !== match.code) continue;
    if (!latest || event.occurredAt > latest.occurredAt) latest = event;
  }
  return latest;
}

/** Title of a reminder row (design: `Call back · Olena Kowal`, `Showroom meeting · …`). */
export type V2TaskTitle =
  | 'callBack'
  | 'callAgain'
  | 'followUpCall'
  | 'showroomMeeting'
  | 'measurement'
  | 'postponed'
  | 'comment';

export interface V2LeadTask {
  readonly kind: LeadReminderKind;
  readonly dueAt: string;
  readonly title: V2TaskTitle;
  /** Comment reminders show the comment itself (cut to 42 characters as the design). */
  readonly text: string | null;
  /** Who does it: the comment assignee, the showroom designer, else the lead's manager. */
  readonly assigneeId: string | null;
  readonly overdue: boolean;
}

const COMMENT_TITLE_LENGTH = 42;

/**
 * Reminders & tasks: the lead's active reminders (the same ones v1 shows and cohorts count),
 * earliest first, so overdue ones come first.
 */
export function v2LeadTasks(lead: Lead, now: Date): readonly V2LeadTask[] {
  return activeRemindersForLead(lead)
    .map((reminder): V2LeadTask => {
      const task = taskDetails(lead, reminder.kind);
      return {
        kind: reminder.kind,
        dueAt: reminder.dueAt,
        ...task,
        overdue: new Date(reminder.dueAt).getTime() < now.getTime(),
      };
    })
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

function taskDetails(
  lead: Lead,
  kind: LeadReminderKind,
): Pick<V2LeadTask, 'title' | 'text' | 'assigneeId'> {
  const manager = lead.assignedToId;
  switch (kind) {
    case 'callback': {
      const code = lead.callbackDueContext?.statusCode ?? lead.callStatus;
      const title =
        code === 'no_answer' ? 'callAgain' : code === 'reached' ? 'followUpCall' : 'callBack';
      return { title, text: null, assigneeId: manager };
    }
    case 'thinking':
      return { title: 'followUpCall', text: null, assigneeId: manager };
    case 'postponed':
      return { title: 'postponed', text: null, assigneeId: manager };
    case 'measurement':
      return { title: 'measurement', text: null, assigneeId: manager };
    case 'showroom':
      return {
        title: 'showroomMeeting',
        text: null,
        assigneeId: lead.visit?.responsibleManagerId ?? manager,
      };
    case 'comment':
      return {
        title: 'comment',
        text: shorten(reminderComment(lead)),
        assigneeId: lead.commentReminderAssignedTo ?? manager,
      };
  }
}

/** The comment that carries the active comment reminder (the latest comment with that date). */
function reminderComment(lead: Lead): string | null {
  let latest: LeadEvent | null = null;
  for (const event of lead.events) {
    if (event.category !== 'comment') continue;
    if (callbackDueAtFromNewValue(event.newValue) !== lead.commentReminderDueAt) continue;
    if (!latest || event.occurredAt > latest.occurredAt) latest = event;
  }
  return latest?.comment?.trim() || null;
}

function shorten(text: string | null): string | null {
  if (!text) return null;
  return text.length > COMMENT_TITLE_LENGTH ? `${text.slice(0, COMMENT_TITLE_LENGTH)}…` : text;
}

function dateTime(at: string | null | undefined): V2CurrentStatusValue | null {
  return at ? { kind: 'dateTime', at } : null;
}

function textValue(value: unknown): V2CurrentStatusValue | null {
  const text = stringValue(value);
  return text ? { kind: 'text', text } : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
