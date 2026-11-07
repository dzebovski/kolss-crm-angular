import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import { v2ProjectDay } from '@domain/v2/project-card';
import { formatV2Money } from '@domain/v2/project-money';
import { v2ProjectStatusLabelKey } from '@domain/v2/project-status';
import type { V2ProjectRowValue, V2ProjectTimelineItem } from '@domain/v2/project-timeline';
import { V2Button } from '../../ui/v2-button';
import {
  V2TimelineEntry,
  type V2TimelineChange,
  type V2TimelineRow,
} from '../../ui/v2-timeline-entry';
import { V2_CANCEL_REASON_LABEL } from './v2-project-cancel-banner';

const PROJECT_TYPE_LABEL = {
  express: 'v2.leadInfo.projectExpress',
  measure: 'v2.leadInfo.projectMeasure',
  contract: 'v2.leadInfo.projectContract',
} as const;

// Timeline card of the Project card board: every project event of API 2.42.0 (created, status,
// estimate, intro / main contract and payment changes, details, comments, measurement visits,
// cancel / restore). Add comment lives in the header.
@Component({
  selector: 'app-v2-project-timeline',
  imports: [TranslatePipe, V2Button, V2TimelineEntry],
  template: `
    <div class="v2-project-timeline__head">
      <h2 class="v2-project-timeline__title">{{ 'v2.timeline.title' | translate }}</h2>
    </div>
    <div class="v2-project-timeline__list">
      @if (loading()) {
        <p class="v2-project-timeline__status" role="status">{{ 'common.loading' | translate }}</p>
      } @else if (loadError()) {
        <div class="v2-project-timeline__status v2-project-timeline__status--error" role="alert">
          {{ 'v2.projectCard.timeline.error' | translate }}
          <button type="button" appV2Button size="sm" (click)="retry.emit()">
            {{ 'v2.leads.retry' | translate }}
          </button>
        </div>
      } @else {
        @for (entry of entries(); track entry.id; let last = $last) {
          <app-v2-timeline-entry
            [date]="entry.date"
            [time]="entry.time"
            [title]="entry.title"
            [author]="entry.author"
            [tone]="entry.tone"
            [last]="last"
            [change]="entry.change"
            [rows]="entry.rows"
            [text]="entry.text"
          />
        } @empty {
          <p class="v2-project-timeline__status">
            {{ 'v2.projectCard.timeline.empty' | translate }}
          </p>
        }
      }
    </div>
  `,
  styleUrl: './v2-project-timeline.scss',
})
export class V2ProjectTimeline {
  private readonly i18n = inject(I18nService);

  readonly items = input.required<readonly V2ProjectTimelineItem[]>();
  readonly now = input.required<Date>();
  /** Employee name by id; null when unknown. */
  readonly personName = input.required<(id: string) => string | null>();
  readonly loading = input(false);
  readonly loadError = input(false);
  readonly retry = output<void>();

  protected readonly entries = computed(() =>
    this.items().map((item) => {
      const locale = this.i18n.locale();
      const change: V2TimelineChange | null = item.change && {
        from: {
          label: this.i18n.t(v2ProjectStatusLabelKey(item.change.from)),
          tone: item.change.from,
        },
        to: { label: this.i18n.t(v2ProjectStatusLabelKey(item.change.to)), tone: item.change.to },
      };
      const rows: readonly V2TimelineRow[] = item.rows.map((row) => ({
        key: this.i18n.t(row.labelKey),
        value: this.rowValue(row.value),
      }));
      // Text is the event comment; "created" adds the lead it came from.
      const text =
        item.text ??
        (item.leadCode
          ? this.i18n.t('v2.projectCard.event.createdText', { code: item.leadCode })
          : null);
      return {
        id: item.id,
        date: formatV2CardDate(item.at, this.now(), locale),
        time: formatV2Time(item.at),
        title: this.i18n.t(item.titleKey),
        author: item.actorName ?? this.i18n.t('v2.card.system'),
        tone: item.tone,
        change,
        rows,
        text,
      };
    }),
  );

  private rowValue(value: V2ProjectRowValue): string {
    const locale = this.i18n.locale();
    switch (value.kind) {
      case 'text':
        return value.text;
      case 'status':
        return this.i18n.t(v2ProjectStatusLabelKey(value.status));
      case 'projectType':
        return this.i18n.t(PROJECT_TYPE_LABEL[value.type]);
      case 'money':
        return formatV2Money(value.money, locale);
      case 'moneyOf':
        return this.i18n.t('v2.projectCard.event.moneyOf', {
          paid: formatV2Money(value.paid, locale),
          total: formatV2Money(value.total, locale),
        });
      case 'day': {
        const day = formatV2CardDate(v2ProjectDay(value.day), this.now(), locale);
        return value.time ? `${day}, ${value.time}` : day;
      }
      case 'person':
        return this.person(value.personId);
      case 'reasons':
        return value.reasons
          .map((reason) => this.i18n.t(V2_CANCEL_REASON_LABEL[reason]))
          .join(', ');
      case 'futureEventsRemoved':
        return this.i18n.t('v2.projectCard.event.futureRemoved');
      case 'prepaymentOverride':
        return this.i18n.t('v2.projectCard.event.prepaymentOverride');
      case 'contractKind':
        return this.i18n.t(
          value.contractKind === 'intro'
            ? 'v2.projectCard.intro.title'
            : 'v2.projectCard.main.title',
        );
      case 'estimateLine':
        return value.money
          ? formatV2Money(value.money, locale)
          : this.i18n.t('v2.projectCard.event.lineRemoved');
      case 'dateTime':
        return `${formatV2CardDate(value.at, this.now(), locale)}, ${formatV2Time(value.at)}`;
    }
  }

  private person(personId: string): string {
    return this.personName()(personId) ?? this.i18n.t('common.unassigned');
  }
}
