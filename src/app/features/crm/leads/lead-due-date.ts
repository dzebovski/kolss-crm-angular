import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { UiIcon } from '../../../ui/icon/ui-icon';

export type LeadDueDateKind = 'status' | 'comment';

@Component({
  selector: 'app-lead-due-date',
  imports: [UiIcon],
  host: {
    '[attr.data-kind]': 'kind()',
  },
  template: `
    <app-ui-icon name="schedule" [size]="13" />
    <time [attr.datetime]="date()">{{ label() }}</time>
  `,
  styles: `
    :host {
      width: fit-content;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin-top: 0.2rem;
      color: var(--ui-action);
      font-size: 0.6875rem;
      font-weight: 650;
      line-height: 1.2;
      white-space: nowrap;
    }

    app-ui-icon {
      flex: 0 0 auto;
    }

    :host([data-kind='comment']) {
      color: var(--ui-warning);
    }
  `,
})
export class LeadDueDate {
  private readonly i18n = inject(I18nService);

  readonly date = input.required<string>();
  readonly kind = input<LeadDueDateKind>('status');

  protected readonly label = computed(() =>
    this.i18n.t(this.kind() === 'comment' ? 'activity.reminderShort' : 'activity.dueDateShort', {
      date: this.i18n.formatShortDate(this.date()),
    }),
  );
}
