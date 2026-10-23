import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { v2TaskCircleActive, v2TaskDue, v2TaskHasCallResult } from '@domain/v2/task-view';
import type { V2Task } from '@domain/v2/task.types';
import { V2Button } from '../ui/v2-button';
import { V2CodeChip } from '../ui/v2-code-chip';
import { V2TaskKindBadge } from './v2-task-kind-badge';
import { V2_TASK_KIND_LABEL } from './v2-task-labels';
import { v2Initials, v2TaskDueView, v2TaskTitle } from './v2-task-presenter';

// One task row (Tasks-my-day-panel.dc.html): status circle, source badge, title with the lead /
// list / source line, In progress pill, the kind's quick action, the due column and (in All tasks
// and lists) the assignee. The title button stretches over the row, so the whole row opens the
// detail panel while the circle and the action stay separate buttons.
@Component({
  selector: 'app-v2-task-row',
  imports: [TranslatePipe, V2Button, V2CodeChip, V2TaskKindBadge],
  templateUrl: './v2-task-row.html',
  styleUrl: './v2-task-row.scss',
  host: { '[class.v2-task-row--selected]': 'selected()' },
})
export class V2TaskRow {
  private readonly i18n = inject(I18nService);

  readonly task = input.required<V2Task>();
  readonly now = input.required<Date>();
  readonly selected = input(false);
  /** Show who has the task (All tasks and task lists). */
  readonly showAssignee = input(false);
  /** Show the task list name; off on a list's own page. */
  readonly showList = input(true);

  readonly open = output<V2Task>();
  /** The circle: toggles a manual task, clears a comment reminder. */
  readonly circle = output<V2Task>();
  /** "Plan next step" of a lead with nothing planned. */
  readonly plan = output<V2Task>();

  protected readonly title = computed(() => {
    this.i18n.locale();
    return v2TaskTitle(this.task(), (key, params) => this.i18n.t(key, params));
  });
  protected readonly done = computed(() => this.task().status === 'done');
  protected readonly kindLabel = computed(() => V2_TASK_KIND_LABEL[this.task().kind]);
  protected readonly circleActive = computed(() => v2TaskCircleActive(this.task()));
  protected readonly due = computed(() => {
    this.i18n.locale();
    return v2TaskDueView(
      v2TaskDue(this.task(), this.now()),
      this.now(),
      this.i18n.locale(),
      (key, params) => this.i18n.t(key, params),
    );
  });
  protected readonly initials = computed(() => v2Initials(this.task().assignee?.name ?? ''));
  protected readonly showCall = computed(() => v2TaskHasCallResult(this.task()));
  protected readonly showVisit = computed(
    () => this.task().kind === 'visit' && this.task().status !== 'done',
  );
  protected readonly showPlan = computed(
    () => this.task().kind === 'nonext' && this.task().status !== 'done',
  );
}
