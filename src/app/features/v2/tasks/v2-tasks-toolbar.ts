import { Component, computed, input, output } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2DayProgress } from '@domain/v2/task-view';
import type { V2TaskKind } from '@domain/v2/task.types';
import { V2SearchField } from '../ui/v2-search-field';
import { V2Select, type V2SelectOption } from '../ui/v2-select';
import { V2_TASK_CHIP_KINDS, V2_TASK_CHIP_LABEL, V2_TASK_KIND_TONE } from './v2-task-labels';

// Page head of My day / Upcoming / All tasks / Done (Tasks-my-day-panel.dc.html): title and
// subtitle, on My day the overdue pill and "N of M done today" bar, then the search, the
// assignee filter (All tasks) and the source chips. A chip that is off hides that source.
@Component({
  selector: 'app-v2-tasks-toolbar',
  imports: [TranslatePipe, V2SearchField, V2Select],
  template: `
    <div class="v2-toolbar__top">
      <div class="v2-toolbar__heading">
        <h2 class="v2-toolbar__title">{{ title() }}</h2>
        <span class="v2-toolbar__sub">{{ subtitle() }}</span>
      </div>
      @if (progress(); as day) {
        <div class="v2-toolbar__day">
          @if (day.overdue > 0) {
            <span class="v2-toolbar__overdue">
              {{ 'v2.tasks.nav.overdue' | translate: { count: day.overdue } }}
            </span>
          }
          <div class="v2-toolbar__progress">
            <span class="v2-toolbar__progress-label">
              {{ 'v2.tasks.progress' | translate: { done: day.done, total: day.total } }}
            </span>
            <div class="v2-toolbar__bar" aria-hidden="true">
              <div class="v2-toolbar__bar-fill" [style.width.%]="percent()"></div>
            </div>
          </div>
        </div>
      }
    </div>

    <div class="v2-toolbar__filters">
      <app-v2-search-field
        class="v2-toolbar__search"
        [ariaLabel]="'v2.tasks.search.label' | translate"
        [placeholder]="'v2.tasks.search.placeholder' | translate"
        [value]="search()"
        (valueChange)="searchChange.emit($event)"
      />
      @if (assigneeOptions(); as options) {
        <app-v2-select
          class="v2-toolbar__assignee"
          [ariaLabel]="'v2.tasks.assignee' | translate"
          [options]="options"
          [value]="assignee()"
          (valueChange)="assigneeChange.emit($event)"
        />
      }
      <span class="v2-toolbar__divider" aria-hidden="true"></span>
      <div
        class="v2-toolbar__chips"
        role="group"
        [attr.aria-label]="'v2.tasks.sources' | translate"
      >
        @for (kind of kinds; track kind) {
          <button
            type="button"
            class="v2-toolbar__chip"
            [class.v2-toolbar__chip--off]="hidden().includes(kind)"
            [style.background]="hidden().includes(kind) ? null : tone(kind).bg"
            [style.color]="
              hidden().includes(kind)
                ? null
                : kind === 'list' || kind === 'personal'
                  ? 'var(--v2-ink-2)'
                  : tone(kind).fg
            "
            [attr.aria-pressed]="!hidden().includes(kind)"
            (click)="kindToggle.emit(kind)"
          >
            {{ chipLabel(kind) | translate }}
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './v2-tasks-toolbar.scss',
})
export class V2TasksToolbar {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  /** My day only. */
  readonly progress = input<V2DayProgress | null>(null);
  readonly search = input('');
  /** All tasks only: the person filter's options (first = Everyone); `null` hides it. */
  readonly assigneeOptions = input<readonly V2SelectOption[] | null>(null);
  readonly assignee = input('');
  readonly hidden = input<readonly V2TaskKind[]>([]);

  readonly searchChange = output<string>();
  readonly assigneeChange = output<string>();
  readonly kindToggle = output<V2TaskKind>();

  protected readonly kinds = V2_TASK_CHIP_KINDS;
  protected readonly percent = computed(() => {
    const day = this.progress();
    return day && day.total > 0 ? Math.round((day.done / day.total) * 100) : 0;
  });

  protected tone(kind: V2TaskKind): { readonly fg: string; readonly bg: string } {
    return V2_TASK_KIND_TONE[kind];
  }

  protected chipLabel(kind: V2TaskKind): (typeof V2_TASK_CHIP_LABEL)[V2TaskKind] {
    return V2_TASK_CHIP_LABEL[kind];
  }
}
