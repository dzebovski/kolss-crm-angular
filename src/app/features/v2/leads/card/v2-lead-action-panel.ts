import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2RelativeTime, formatV2ReminderDate, formatV2Time } from '@domain/v2/date-format';
import type { V2ActionSuggestion, V2SuggestionTitle } from '@domain/v2/lead-action';
import type { V2LeadRating } from '@domain/v2/lead-view.types';
import { V2Button } from '../../ui/v2-button';
import { V2RatingSwitch } from '../../ui/v2-rating-switch';
import { V2_STATUS_LABEL } from '../../ui/v2-tone';

export type V2CallResult = 'success' | 'later' | 'noanswer';
export type V2StatusChange = 'thinking' | 'invited' | 'lost';

const TITLE: Record<V2SuggestionTitle, MessageKey> = {
  makeCall: 'v2.action.makeCall',
  callAgain: 'v2.action.callAgain',
  scheduledCall: 'v2.action.scheduledCall',
  followUp: 'v2.action.followUp',
  showroomMeeting: 'v2.action.showroomMeeting',
  planNextStep: 'v2.action.planNextStep',
  noAction: 'v2.action.noAction',
  projectCreated: 'v2.action.projectCreated',
};

// Action panel from lead card v1.3 and design system ActionPanel: action suggestion + the three
// call result buttons, a `line-strong` divider, then lead status buttons (never highlighted,
// they open popups), RatingSwitch, Add comment and Fill lead info. Presentational: the page
// opens the popups and saves the rating.
@Component({
  selector: 'app-v2-lead-action-panel',
  imports: [TranslatePipe, V2Button, V2RatingSwitch],
  templateUrl: './v2-lead-action-panel.html',
  styleUrl: './v2-lead-action-panel.scss',
})
export class V2LeadActionPanel {
  private readonly i18n = inject(I18nService);

  readonly suggestion = input.required<V2ActionSuggestion>();
  readonly now = input.required<Date>();
  readonly rating = input<V2LeadRating | null>(null);
  /** Call results, lead status, rating and lead info (off for a project, lost or read-only lead). */
  readonly actionsEnabled = input(false);
  /** Add comment stays open on a project (design); off on lost or read-only leads. */
  readonly commentEnabled = input(false);
  readonly pending = input(false);
  readonly callResult = output<V2CallResult>();
  readonly statusChange = output<V2StatusChange>();
  readonly ratingSelect = output<V2LeadRating>();
  readonly addComment = output<void>();
  readonly fillInfo = output<void>();

  protected readonly callResults: readonly V2CallResult[] = ['success', 'later', 'noanswer'];
  protected readonly statusChanges: readonly V2StatusChange[] = ['thinking', 'invited', 'lost'];
  protected readonly statusLabels = V2_STATUS_LABEL;

  protected readonly title = computed(() => TITLE[this.suggestion().title]);

  protected readonly on = computed(() => {
    const { on, overdue } = this.suggestion();
    if (!on) return null;
    const when = `${formatV2ReminderDate(on, this.now(), this.i18n.locale())}, ${formatV2Time(on)}`;
    return this.i18n.t('v2.action.on', {
      date: overdue ? `${this.i18n.t('v2.action.overdue')} · ${when}` : when,
    });
  });

  protected readonly caption = computed(() => {
    const caption = this.suggestion().caption;
    const locale = this.i18n.locale();
    switch (caption.kind) {
      case 'created':
        return this.i18n.t('v2.action.created', {
          time: formatV2RelativeTime(caption.at, this.now(), locale),
        });
      case 'lastCall':
        return this.i18n.t('v2.action.lastCall', {
          time: formatV2RelativeTime(caption.at, this.now(), locale),
        });
      case 'lost':
        return this.i18n.t('v2.action.leadLost');
      case 'project':
        return this.i18n.t('v2.action.inProject');
    }
  });
}
