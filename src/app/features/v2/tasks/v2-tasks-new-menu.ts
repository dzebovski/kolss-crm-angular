import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Component, output } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';

const TASK_VALUE = 'task';
const LIST_VALUE = 'list';

// "New" button with its two-item menu (Tasks-my-day-panel.dc.html, header): Task and Task list.
@Component({
  selector: 'app-v2-tasks-new-menu',
  imports: [Menu, MenuContent, MenuItem, MenuTrigger, TranslatePipe],
  template: `
    <button
      type="button"
      class="v2-new-menu__trigger"
      ngMenuTrigger
      [menu]="menu"
      [attr.aria-label]="'v2.tasks.newMenu' | translate"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
      {{ 'v2.tasks.new' | translate }}
      <span class="v2-new-menu__divider" aria-hidden="true"></span>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div
      ngMenu
      #menu="ngMenu"
      class="v2-new-menu__panel"
      [class.v2-new-menu__panel--visible]="menu.visible()"
      [attr.aria-label]="'v2.tasks.newMenu' | translate"
      (itemSelected)="select($event)"
    >
      <ng-template ngMenuContent>
        <button type="button" ngMenuItem class="v2-new-menu__item" [value]="taskValue">
          <span class="v2-new-menu__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          <span class="v2-new-menu__text">
            <span class="v2-new-menu__label">{{ 'v2.tasks.newTask.menu' | translate }}</span>
            <span class="v2-new-menu__hint">{{ 'v2.tasks.newTask.menuHint' | translate }}</span>
          </span>
        </button>
        <button type="button" ngMenuItem class="v2-new-menu__item" [value]="listValue">
          <span class="v2-new-menu__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M9 6h11" />
              <path d="M9 12h11" />
              <path d="M9 18h11" />
              <path d="M4 6h.01" />
              <path d="M4 12h.01" />
              <path d="M4 18h.01" />
            </svg>
          </span>
          <span class="v2-new-menu__text">
            <span class="v2-new-menu__label">{{ 'v2.tasks.newList.menu' | translate }}</span>
            <span class="v2-new-menu__hint">{{ 'v2.tasks.newList.menuHint' | translate }}</span>
          </span>
        </button>
      </ng-template>
    </div>
  `,
  styleUrl: './v2-tasks-new-menu.scss',
})
export class V2TasksNewMenu {
  readonly newTask = output<void>();
  readonly newList = output<void>();

  protected readonly taskValue = TASK_VALUE;
  protected readonly listValue = LIST_VALUE;

  protected select(value: string): void {
    if (value === TASK_VALUE) this.newTask.emit();
    if (value === LIST_VALUE) this.newList.emit();
  }
}
