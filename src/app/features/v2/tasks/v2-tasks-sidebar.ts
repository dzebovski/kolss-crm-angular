import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2TaskCounts, V2TaskList, V2TaskView } from '@domain/v2/task.types';

interface NavLink {
  readonly view: Exclude<V2TaskView, 'list'>;
  readonly labelKey:
    'v2.tasks.view.my_day' | 'v2.tasks.view.upcoming' | 'v2.tasks.view.all' | 'v2.tasks.view.done';
  readonly count: number | null;
  readonly danger: boolean;
}

// Views and task lists (Tasks-my-day-panel.dc.html, left card, 248px): My day, Upcoming, All
// tasks (admins, curators), Done, then TASK LISTS with a + button and `done/total` per list.
// The links keep the search and the source chips and drop the task selection.
@Component({
  selector: 'app-v2-tasks-sidebar',
  imports: [RouterLink, TranslatePipe],
  template: `
    <nav class="v2-tasks-nav" [attr.aria-label]="'v2.tasks.nav.label' | translate">
      @for (link of links(); track link.view) {
        <a
          class="v2-tasks-nav__item"
          routerLink="."
          [queryParams]="{
            view: link.view === 'my_day' ? null : link.view,
            list: null,
            task: null,
            who: null,
          }"
          queryParamsHandling="merge"
          [attr.aria-current]="link.view === view() && !listId() ? 'page' : null"
        >
          <span>{{ link.labelKey | translate }}</span>
          @if (link.count !== null) {
            <span class="v2-tasks-nav__count" [class.v2-tasks-nav__count--danger]="link.danger">
              {{
                link.danger
                  ? ('v2.tasks.nav.overdue' | translate: { count: link.count })
                  : link.count
              }}
            </span>
          }
        </a>
      }

      <div class="v2-tasks-nav__lists-head">
        <span class="v2-tasks-nav__lists-title">{{ 'v2.tasks.nav.lists' | translate }}</span>
        <button
          type="button"
          class="v2-tasks-nav__add"
          [attr.aria-label]="'v2.tasks.nav.newList' | translate"
          (click)="newList.emit()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      @if (listsFailed()) {
        <p class="v2-tasks-nav__note" role="alert">{{ 'v2.tasks.nav.listsError' | translate }}</p>
      }
      @for (list of lists(); track list.id) {
        <a
          class="v2-tasks-nav__item"
          routerLink="."
          [queryParams]="{ view: null, list: list.id, task: null, who: null }"
          queryParamsHandling="merge"
          [attr.aria-current]="list.id === listId() ? 'page' : null"
        >
          <span class="v2-tasks-nav__dot" [style.background]="list.color" aria-hidden="true"></span>
          <span class="v2-tasks-nav__name">{{ list.name }}</span>
          <span class="v2-tasks-nav__count">{{ list.doneCount }}/{{ list.taskCount }}</span>
        </a>
      }

      <p class="v2-tasks-nav__note">{{ 'v2.tasks.nav.listsNote' | translate }}</p>
    </nav>
  `,
  styleUrl: './v2-tasks-sidebar.scss',
})
export class V2TasksSidebar {
  readonly view = input.required<V2TaskView>();
  readonly listId = input<string | null>(null);
  readonly counts = input<V2TaskCounts | null>(null);
  readonly lists = input<readonly V2TaskList[]>([]);
  readonly listsFailed = input(false);
  /** "All tasks" is for admins and curators. */
  readonly canViewAll = input(false);

  readonly newList = output<void>();

  protected readonly links = computed<readonly NavLink[]>(() => {
    const counts = this.counts();
    const links: NavLink[] = [
      {
        view: 'my_day',
        labelKey: 'v2.tasks.view.my_day',
        count: counts?.myDay ?? null,
        danger: false,
      },
      {
        view: 'upcoming',
        labelKey: 'v2.tasks.view.upcoming',
        count: counts?.upcoming ?? null,
        danger: false,
      },
    ];
    if (this.canViewAll()) {
      links.push({
        view: 'all',
        labelKey: 'v2.tasks.view.all',
        count: counts?.overdue ?? null,
        danger: true,
      });
    }
    links.push({ view: 'done', labelKey: 'v2.tasks.view.done', count: null, danger: false });
    return links;
  });
}
