import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2ReminderDate, formatV2Time, formatV2TimeRange } from '@domain/v2/date-format';
import type {
  V2CurrentStatus,
  V2CurrentStatusLabel,
  V2CurrentStatusValue,
} from '@domain/v2/lead-card-status';
import type { V2LeadDisplayStatus } from '@domain/v2/lead-view.types';
import { V2EmptyState } from '../../ui/v2-empty-state';
import { V2InfoCard } from '../../ui/v2-info-card';
import { V2_STATUS_LABEL, v2ToneColor } from '../../ui/v2-tone';

const ROW_LABEL: Record<V2CurrentStatusLabel, MessageKey> = {
  attempt: 'v2.current.attempt',
  nextAttempt: 'v2.current.nextAttempt',
  callBack: 'v2.current.callBack',
  call: 'v2.current.call',
  nextAction: 'v2.current.nextAction',
  followUp: 'v2.current.followUp',
  when: 'v2.current.when',
  designer: 'v2.current.designer',
  where: 'v2.current.where',
  reason: 'v2.current.reason',
};

// Current status card from lead card v1.3: the status with its dot on the right of the title,
// Key / value rows of the change that set it, and its comment on `ground`. A new lead shows the
// "No status yet" empty state.
@Component({
  selector: 'app-v2-current-status-card',
  imports: [TranslatePipe, V2EmptyState, V2InfoCard],
  template: `
    <app-v2-info-card class="v2-current" [title]="'v2.current.title' | translate">
      @if (current()) {
        <span v2CardAside class="v2-current__status">
          <span class="v2-current__dot" [style.background]="dotColor()" aria-hidden="true"></span>
          {{ statusLabel() | translate }}
        </span>
      }

      @if (current(); as current) {
        <div class="v2-current__body">
          @if (rows().length) {
            <dl class="v2-current__rows">
              @for (row of rows(); track row.label) {
                <dt>{{ row.labelKey | translate }}</dt>
                <dd>{{ row.value }}</dd>
              }
            </dl>
          }
          @if (current.comment) {
            <p class="v2-current__comment">{{ current.comment }}</p>
          }
        </div>
      } @else {
        <app-v2-empty-state
          [title]="'v2.current.empty.title' | translate"
          [hint]="'v2.current.empty.hint' | translate"
        />
      }
    </app-v2-info-card>
  `,
  styles: `
    :host {
      display: flex;
    }

    .v2-current {
      flex-grow: 1;
      min-height: 272px;
    }

    .v2-current__status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    .v2-current__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--v2-radius-pill);
    }

    .v2-current__body {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-4);
    }

    // 110px label column is a board value without a token.
    .v2-current__rows {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr);
      gap: 10px var(--v2-space-3);
      margin: 0;
      font-size: 14px;

      dt {
        color: var(--v2-muted);
      }

      dd {
        margin: 0;
        font-weight: 500;
        overflow-wrap: anywhere;
      }
    }

    // 12/14px padding is a board value without a token.
    .v2-current__comment {
      margin: 0;
      padding: var(--v2-space-3) 14px;
      border-radius: var(--v2-radius-md);
      background: var(--v2-ground);
      color: var(--v2-ink-2);
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
  `,
})
export class V2CurrentStatusCard {
  private readonly i18n = inject(I18nService);

  readonly status = input.required<V2LeadDisplayStatus>();
  readonly current = input.required<V2CurrentStatus | null>();
  readonly now = input.required<Date>();
  readonly officeKey = input.required<MessageKey>();
  /** Display name of a user id; null when unknown. */
  readonly personName = input.required<(id: string) => string | null>();

  protected readonly statusLabel = computed(() => V2_STATUS_LABEL[this.status()]);
  protected readonly dotColor = computed(() => v2ToneColor(this.status()));

  protected readonly rows = computed(() =>
    (this.current()?.rows ?? []).map((row) => ({
      label: row.label,
      labelKey: ROW_LABEL[row.label],
      value: this.formatValue(row.value),
    })),
  );

  private formatValue(value: V2CurrentStatusValue): string {
    const locale = this.i18n.locale();
    const now = this.now();
    switch (value.kind) {
      case 'text':
        return value.text;
      case 'dateTime':
        return `${formatV2ReminderDate(value.at, now, locale)}, ${formatV2Time(value.at)}`;
      case 'range':
        return `${formatV2ReminderDate(value.start, now, locale)}, ${
          value.end ? formatV2TimeRange(value.start, value.end) : formatV2Time(value.start)
        }`;
      case 'person':
        return this.personName()(value.id) ?? this.i18n.t('common.unknown');
      case 'office':
        return this.i18n.t(this.officeKey());
      case 'lossReason':
        return this.i18n.closeReasonLabel(value.code);
      case 'notSet':
        return this.i18n.t('v2.card.notSet');
    }
  }
}
