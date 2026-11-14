import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import { v2ProjectDay } from '@domain/v2/project-card';
import {
  v2CanChangeMeeting,
  v2MeetingNeedsOutcome,
  type V2ProjectMeeting,
  type V2ProjectMeetingStatus,
} from '@domain/v2/project-meetings';
import type { V2Task } from '@domain/v2/task.types';
import { V2Button } from '../../ui/v2-button';
import { V2_MEETING_KIND_LABEL } from '../dialogs/v2-project-meeting-dialog';

const MEETING_STATUS_LABEL: Record<V2ProjectMeetingStatus, MessageKey> = {
  scheduled: 'v2.projectMeetings.status.scheduled',
  visited: 'v2.projectMeetings.status.visited',
  no_show: 'v2.projectMeetings.status.no_show',
  canceled: 'v2.projectMeetings.status.canceled',
};

export interface V2MeetingOutcome {
  readonly meeting: V2ProjectMeeting;
  readonly status: 'visited' | 'no_show' | 'canceled';
}

// Tasks and meetings of the Statuses & tasks tab (P12; no board, design-system rows). Tasks: a
// check box marks a task done (when the user may manage it), due date and assignee. Meetings: kind,
// date and time, manager and status; a scheduled one has Held / No-show / Reschedule / Cancel.
// Presentational: the page opens the popups and runs the changes.
@Component({
  selector: 'app-v2-project-activities',
  imports: [TranslatePipe, V2Button],
  templateUrl: './v2-project-activities.html',
  styleUrl: './v2-project-activities.scss',
})
export class V2ProjectActivities {
  private readonly i18n = inject(I18nService);

  readonly tasks = input.required<readonly V2Task[]>();
  readonly meetings = input.required<readonly V2ProjectMeeting[]>();
  readonly loading = input(false);
  readonly loadError = input(false);
  /** New tasks and meetings, and meeting changes: the project is open. */
  readonly canPlan = input(false);
  /** The task or meeting being changed. */
  readonly busyId = input<string | null>(null);
  readonly error = input('');
  readonly now = input.required<Date>();
  readonly retry = output<void>();
  readonly addTask = output<void>();
  readonly toggleTask = output<V2Task>();
  readonly addMeeting = output<void>();
  readonly reschedule = output<V2ProjectMeeting>();
  readonly outcome = output<V2MeetingOutcome>();

  protected readonly taskRows = computed(() => {
    const locale = this.i18n.locale();
    const now = this.now();
    return this.tasks().map((task) => {
      const due = task.dueDate
        ? `${formatV2CardDate(v2ProjectDay(task.dueDate), now, locale)}${task.dueTime ? `, ${task.dueTime}` : ''}`
        : this.i18n.t('v2.tasks.due.none');
      return {
        task,
        done: task.status === 'done',
        overdue: task.status !== 'done' && task.overdueDays > 0,
        meta: [due, task.assignee?.name || this.i18n.t('common.unassigned')].join(' · '),
      };
    });
  });

  protected readonly meetingRows = computed(() => {
    const locale = this.i18n.locale();
    const now = this.now();
    const open = this.canPlan();
    return this.meetings().map((meeting) => ({
      meeting,
      kindKey: V2_MEETING_KIND_LABEL[meeting.kind],
      statusKey: MEETING_STATUS_LABEL[meeting.status],
      when: `${formatV2CardDate(meeting.startsAt, now, locale)}, ${formatV2Time(meeting.startsAt)}–${formatV2Time(meeting.endsAt)}`,
      manager: meeting.manager?.name || this.i18n.t('common.unassigned'),
      canChange: v2CanChangeMeeting(meeting, open),
      needsOutcome: v2MeetingNeedsOutcome(meeting, now),
    }));
  });
}
