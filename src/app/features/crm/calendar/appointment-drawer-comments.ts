import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { LeadEvent } from '@domain/lead.types';
import { UiButton } from '@ui/button/ui-button';
import { LinkifiedText } from '@ui/text/linkified-text';

@Component({
  selector: 'app-appointment-drawer-comments',
  imports: [LinkifiedText, UiButton],
  template: `
    @if (loading()) {
      <p class="comments-state" role="status">{{ i18n.t('common.loading') }}</p>
    } @else if (error()) {
      <div class="comments-state comments-state--error" role="alert">
        <span>{{ i18n.t('calendar.commentsLoadFailed') }}</span>
        <app-ui-button size="small" variant="ghost" (pressed)="retry.emit()">
          {{ i18n.t('calendar.retry') }}
        </app-ui-button>
      </div>
    } @else if (comments().length) {
      <section class="drawer-comments" aria-labelledby="appointment-comments-title">
        <header>
          <h3 id="appointment-comments-title">{{ i18n.t('calendar.clientComments') }}</h3>
          <span>{{ comments().length }}</span>
        </header>
        <ol>
          @for (event of comments(); track event.id) {
            <li>
              <p><app-linkified-text [text]="event.comment" /></p>
              <footer>
                <span>{{ event.actorName?.trim() || i18n.t('common.unknown') }}</span>
                <time [attr.datetime]="event.occurredAt">
                  {{ i18n.formatDateTime(event.occurredAt) }}
                </time>
              </footer>
            </li>
          }
        </ol>
      </section>
    }
  `,
  styleUrl: './appointment-drawer-comments.scss',
})
export class AppointmentDrawerComments {
  protected readonly i18n = inject(I18nService);

  readonly events = input<readonly LeadEvent[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly retry = output<void>();

  protected readonly comments = computed(() =>
    [...this.events()]
      .filter((event) => !!event.comment?.trim())
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
  );
}
