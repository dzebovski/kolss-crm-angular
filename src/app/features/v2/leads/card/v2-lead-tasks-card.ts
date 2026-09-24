import { Component, computed, inject, input, output, signal } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { LeadReminderKind } from '@domain/lead.rules';
import {
  calendarDayDiff,
  formatV2ReminderDate,
  formatV2Time,
  formatV2Weekday,
} from '@domain/v2/date-format';
import type { V2LeadTask, V2TaskTitle } from '@domain/v2/lead-card-status';
import { V2DateTile, type V2DateTileTone } from '../../ui/v2-date-tile';
import { V2InfoCard } from '../../ui/v2-info-card';

/** Rows shown before "Show all" (design `TASKS_SHOWN`). */
const TASKS_SHOWN = 3;

const TITLE: Record<Exclude<V2TaskTitle, 'comment'>, MessageKey> = {
  callBack: 'v2.task.callBack',
  callAgain: 'v2.task.callAgain',
  followUpCall: 'v2.task.followUpCall',
  showroomMeeting: 'v2.task.showroomMeeting',
  measurement: 'v2.task.measurement',
  postponed: 'v2.task.postponed',
};

// Reminders & tasks card from lead card v1.3: "N open · K overdue", the 3 nearest reminders
// (date tile, title, when · who, done button), "Show all N (+k)", and the red "No next step
// planned" notice when nothing is planned on an open lead.
@Component({
  selector: 'app-v2-lead-tasks-card',
  imports: [TranslatePipe, V2DateTile, V2InfoCard],
  templateUrl: './v2-lead-tasks-card.html',
  styleUrl: './v2-lead-tasks-card.scss',
})
export class V2LeadTasksCard {
  private readonly i18n = inject(I18nService);

  readonly tasks = input.required<readonly V2LeadTask[]>();
  readonly now = input.required<Date>();
  readonly leadName = input.required<string>();
  /** Display name of a user id; null when unknown. */
  readonly personName = input.required<(id: string) => string | null>();
  /** Lost / project leads need no next step, so they don't show the notice. */
  readonly needsNextStep = input(true);
  readonly canComplete = input(false);
  readonly pending = input(false);
  readonly complete = output<LeadReminderKind>();

  protected readonly expanded = signal(false);

  protected readonly overdueCount = computed(
    () => this.tasks().filter((task) => task.overdue).length,
  );
  protected readonly more = computed(() => this.tasks().length - TASKS_SHOWN);

  protected readonly rows = computed(() => {
    const now = this.now();
    const locale = this.i18n.locale();
    const shown = this.expanded() ? this.tasks() : this.tasks().slice(0, TASKS_SHOWN);
    return shown.map((task) => {
      const date = new Date(task.dueAt);
      const tone: V2DateTileTone = task.overdue
        ? 'overdue'
        : calendarDayDiff(date, now) === 0
          ? 'today'
          : 'default';
      const when = `${formatV2ReminderDate(date, now, locale)}, ${formatV2Time(date)}`;
      const who = task.assigneeId ? this.personName()(task.assigneeId) : null;
      return {
        kind: task.kind,
        tone,
        weekday: formatV2Weekday(date, locale),
        day: date.getDate(),
        title: this.title(task),
        when: task.overdue ? `${this.i18n.t('v2.tasks.overdue')} · ${when}` : when,
        who: who ?? this.i18n.t('common.unassigned'),
        overdue: task.overdue,
      };
    });
  });

  protected toggle(): void {
    this.expanded.update((expanded) => !expanded);
  }

  private title(task: V2LeadTask): string {
    if (task.title === 'comment') return task.text ?? this.i18n.t('v2.task.comment');
    return this.i18n.t(TITLE[task.title], { name: this.leadName() });
  }
}
