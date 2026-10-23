import { Component, computed, input, output, signal } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2TaskGroup } from '@domain/v2/task-view';
import type { V2Task } from '@domain/v2/task.types';
import { V2TaskRow } from './v2-task-row';

// One section card of the Tasks boards: 48px header (label, count, optional Show / Hide), the
// rows, the "Nothing overdue" / "No tasks here" line, the "Show N done today" fold and, on a
// list's To do group, "Add task to this list".
@Component({
  selector: 'app-v2-task-group',
  imports: [TranslatePipe, V2TaskRow],
  template: `
    <header class="v2-group__head">
      <h3 class="v2-group__label" [class.v2-group__label--danger]="danger()">{{ label() }}</h3>
      <span class="v2-group__count" [class.v2-group__count--danger]="danger()">
        {{ group().items.length }}
      </span>
      <span class="v2-group__spacer"></span>
      @if (collapsible()) {
        <button
          type="button"
          class="v2-group__link"
          [attr.aria-expanded]="expanded()"
          (click)="toggleExpanded()"
        >
          {{ (expanded() ? 'v2.tasks.group.hide' : 'v2.tasks.group.show') | translate }}
        </button>
      }
    </header>

    @if (!collapsible() || expanded()) {
      @for (task of group().items; track task.id) {
        <app-v2-task-row
          [task]="task"
          [now]="now()"
          [selected]="task.id === selectedId()"
          [showAssignee]="showAssignee()"
          [showList]="showList()"
          (open)="open.emit($event)"
          (circle)="circle.emit($event)"
          (plan)="plan.emit($event)"
        />
      }
    }

    @if (isEmpty()) {
      <p class="v2-group__empty">{{ emptyText() }}</p>
    }

    @if (group().doneItems.length > 0) {
      <button
        type="button"
        class="v2-group__fold"
        [attr.aria-expanded]="doneShown()"
        (click)="doneShown.set(!doneShown())"
      >
        {{
          (doneShown() ? 'v2.tasks.group.hideDone' : 'v2.tasks.group.showDone')
            | translate: { count: group().doneItems.length }
        }}
      </button>
      @if (doneShown()) {
        @for (task of group().doneItems; track task.id) {
          <app-v2-task-row
            [task]="task"
            [now]="now()"
            [selected]="task.id === selectedId()"
            [showAssignee]="showAssignee()"
            [showList]="showList()"
            (open)="open.emit($event)"
            (circle)="circle.emit($event)"
          />
        }
      }
    }

    @if (canAdd()) {
      <button type="button" class="v2-group__add" (click)="add.emit()">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        {{ 'v2.tasks.addToList' | translate }}
      </button>
    }
  `,
  styleUrl: './v2-task-group.scss',
})
export class V2TaskGroupCard {
  readonly group = input.required<V2TaskGroup>();
  readonly label = input.required<string>();
  readonly emptyText = input.required<string>();
  readonly now = input.required<Date>();
  readonly selectedId = input<string | null>(null);
  readonly showAssignee = input(false);
  readonly showList = input(true);
  /** Overdue: red label and count while it has items. */
  readonly danger = input(false);
  /** A list's Done group: folded behind Show / Hide. */
  readonly collapsible = input(false);
  readonly canAdd = input(false);

  readonly open = output<V2Task>();
  readonly circle = output<V2Task>();
  readonly plan = output<V2Task>();
  readonly add = output<void>();

  protected readonly expanded = signal(false);
  protected readonly doneShown = signal(false);

  protected readonly isEmpty = computed(
    () => this.group().items.length === 0 && this.group().doneItems.length === 0,
  );

  protected toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }
}
