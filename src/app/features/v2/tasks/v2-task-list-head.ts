import { Component, computed, input, output } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2TaskList } from '@domain/v2/task.types';
import { V2Button } from '../ui/v2-button';
import { v2Initials } from './v2-task-presenter';

// Task list page head (Tasks-list-expo.dc.html): colour dot and "visible to everyone" eyebrow,
// name, description, Edit list (owner), then When · Owner · People · progress with the overdue count.
@Component({
  selector: 'app-v2-task-list-head',
  imports: [TranslatePipe, V2Button],
  template: `
    @let item = list();
    <div class="v2-list-head__top">
      <div class="v2-list-head__heading">
        <div class="v2-list-head__eyebrow">
          <span class="v2-list-head__dot" [style.background]="item.color" aria-hidden="true"></span>
          <span>{{ 'v2.tasks.list.eyebrow' | translate }}</span>
        </div>
        <h2 class="v2-list-head__title">{{ item.name }}</h2>
        @if (item.description) {
          <span class="v2-list-head__description">{{ item.description }}</span>
        }
      </div>
      @if (canEdit()) {
        <button type="button" appV2Button size="sm" (click)="edit.emit()">
          {{ 'v2.tasks.list.edit' | translate }}
        </button>
      }
    </div>
    <dl class="v2-list-head__facts">
      <div class="v2-list-head__fact">
        <dt>{{ 'v2.tasks.list.when' | translate }}</dt>
        <dd>{{ item.datesText || '—' }}</dd>
      </div>
      <div class="v2-list-head__fact">
        <dt>{{ 'v2.tasks.list.owner' | translate }}</dt>
        <dd>{{ item.owner?.name || '—' }}</dd>
      </div>
      <div class="v2-list-head__fact">
        <dt>{{ 'v2.tasks.list.people' | translate }}</dt>
        <dd class="v2-list-head__people">
          @for (member of item.members; track member.id) {
            <span class="v2-list-head__avatar" [attr.title]="member.name">{{
              initials(member.name)
            }}</span>
          }
        </dd>
      </div>
      <div class="v2-list-head__fact">
        <dt class="v2-list-head__progress-row">
          <span>{{
            'v2.tasks.list.progress' | translate: { done: item.doneCount, total: item.taskCount }
          }}</span>
          @if (item.overdueCount > 0) {
            <span class="v2-list-head__overdue">
              {{ 'v2.tasks.nav.overdue' | translate: { count: item.overdueCount } }}
            </span>
          }
        </dt>
        <dd>
          <div class="v2-list-head__bar" aria-hidden="true">
            <div class="v2-list-head__bar-fill" [style.width.%]="percent()"></div>
          </div>
        </dd>
      </div>
    </dl>
  `,
  styleUrl: './v2-task-list-head.scss',
})
export class V2TaskListHead {
  readonly list = input.required<V2TaskList>();
  readonly canEdit = input(false);

  readonly edit = output<void>();

  protected readonly percent = computed(() => {
    const list = this.list();
    return list.taskCount > 0 ? Math.round((list.doneCount / list.taskCount) * 100) : 0;
  });

  protected initials(name: string): string {
    return v2Initials(name);
  }
}
