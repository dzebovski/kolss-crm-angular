import type { Appointment, ProjectActivities } from '@core/api/generated/kolss-api.types';
import { toV2Task } from './task.mapper';
import type { V2Task } from './task.types';

/**
 * Tasks and meetings of a project (P12, API 2.44.0): the Statuses & tasks tab of the project
 * card. A project meeting is a showroom meeting or a measurement booked on the project; it never
 * changes the lead's statuses. Pure: the tab formats dates and names.
 */

export type V2ProjectMeetingKind = 'showroom' | 'measurement';
export type V2ProjectMeetingStatus = 'scheduled' | 'visited' | 'no_show' | 'canceled';

export const V2_PROJECT_MEETING_KINDS: readonly V2ProjectMeetingKind[] = [
  'showroom',
  'measurement',
];
/** Duration choices of the meeting popup, in minutes (the API takes 15-minute steps). */
export const V2_PROJECT_MEETING_DURATIONS: readonly number[] = [30, 60, 90, 120, 180];

export interface V2ProjectMeeting {
  readonly id: string;
  readonly kind: V2ProjectMeetingKind;
  readonly status: V2ProjectMeetingStatus;
  /** ISO timestamps. */
  readonly startsAt: string;
  readonly endsAt: string;
  readonly manager: { readonly id: string; readonly name: string } | null;
  readonly comment: string | null;
  readonly version: number;
  /** The manager has another meeting at that time. */
  readonly hasConflict: boolean;
  readonly timezone: string;
}

export interface V2ProjectActivities {
  /** Open tasks first (by due date), then done ones. */
  readonly tasks: readonly V2Task[];
  /** Latest first, as the API returns them. */
  readonly meetings: readonly V2ProjectMeeting[];
}

export function toV2ProjectMeeting(appointment: Appointment): V2ProjectMeeting {
  return {
    id: appointment.id,
    // Office work is never booked on a project; show anything else as a showroom meeting.
    kind: appointment.kind === 'measurement' ? 'measurement' : 'showroom',
    // `rescheduled` is a legacy value: the row was moved and stays scheduled.
    status: appointment.status === 'rescheduled' ? 'scheduled' : appointment.status,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    manager: appointment.responsibleManager
      ? {
          id: appointment.responsibleManager.id,
          name: appointment.responsibleManager.displayName.trim(),
        }
      : null,
    comment: appointment.comment?.trim() || null,
    version: appointment.version,
    hasConflict: appointment.hasConflict,
    timezone: appointment.office.timezoneName,
  };
}

export function toV2ProjectActivities(response: ProjectActivities): V2ProjectActivities {
  return {
    tasks: response.tasks.map(toV2Task),
    meetings: response.meetings.map(toV2ProjectMeeting),
  };
}

/** Held / No-show / Reschedule / Cancel: only a scheduled meeting, while the project is open. */
export function v2CanChangeMeeting(meeting: V2ProjectMeeting, projectOpen: boolean): boolean {
  return projectOpen && meeting.status === 'scheduled';
}

/** A scheduled meeting whose end has passed still waits for Held / No-show. */
export function v2MeetingNeedsOutcome(meeting: V2ProjectMeeting, now: Date): boolean {
  return meeting.status === 'scheduled' && new Date(meeting.endsAt).getTime() < now.getTime();
}

/** The next scheduled meeting (earliest start that has not ended), or null. */
export function v2NextProjectMeeting(
  meetings: readonly V2ProjectMeeting[],
  now: Date,
): V2ProjectMeeting | null {
  return (
    meetings
      .filter(
        (meeting) =>
          meeting.status === 'scheduled' && new Date(meeting.endsAt).getTime() >= now.getTime(),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
  );
}

/** Minutes between start and end, for the Reschedule popup. */
export function v2MeetingDuration(meeting: Pick<V2ProjectMeeting, 'startsAt' | 'endsAt'>): number {
  return Math.round(
    (new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime()) / 60000,
  );
}

export interface V2MeetingDraft {
  readonly kind: V2ProjectMeetingKind;
  /** `YYYY-MM-DD`, office-local. */
  readonly date: string;
  /** `HH:MM`, office-local. */
  readonly time: string;
  readonly duration: number;
  readonly managerId: string;
  readonly comment: string;
}

export type V2MeetingDraftError = 'date' | 'datePassed' | 'time' | 'manager' | 'comment';

/** Errors of the meeting popup; `today` is the office-local day. */
export function v2MeetingDraftErrors(
  draft: V2MeetingDraft,
  today: string,
): Partial<Record<'date' | 'time' | 'manager' | 'comment', V2MeetingDraftError>> {
  const errors: Partial<Record<'date' | 'time' | 'manager' | 'comment', V2MeetingDraftError>> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.date = 'date';
  else if (draft.date < today) errors.date = 'datePassed';
  if (!/^\d{2}:\d{2}$/.test(draft.time)) errors.time = 'time';
  if (!draft.managerId) errors.manager = 'manager';
  if (draft.comment.trim().length > 5000) errors.comment = 'comment';
  return errors;
}

/** `startsAtLocal` of the appointment API: office-local `YYYY-MM-DDTHH:MM`. */
export function v2MeetingStartsAtLocal(draft: Pick<V2MeetingDraft, 'date' | 'time'>): string {
  return `${draft.date}T${draft.time}`;
}

/** Office-local date and time of an ISO instant, for the Reschedule popup. */
export function v2MeetingLocalParts(
  iso: string,
  timezone: string,
): { readonly date: string; readonly time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}
