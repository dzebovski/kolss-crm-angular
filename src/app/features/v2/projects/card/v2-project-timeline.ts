import { Component, computed, inject, input, output } from '@angular/core';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import { v2ProjectDay } from '@domain/v2/project-card';
import { formatV2Money } from '@domain/v2/project-money';
import { V2_PROJECT_STATUS_COLOR, v2ProjectStatusLabelKey } from '@domain/v2/project-status';
import type {
  V2ProjectRowValue,
  V2ProjectTimelineItem,
  V2ProjectTimelineTone,
} from '@domain/v2/project-timeline';
import { V2Button } from '../../ui/v2-button';
import { V2_PAYMENT_BASIS_LABEL } from '../dialogs/v2-project-payment-labels';
import { V2_CANCEL_REASON_LABEL } from './v2-project-cancel-banner';

const PROJECT_TYPE_LABEL = {
  express: 'v2.leadInfo.projectExpress',
  measure: 'v2.leadInfo.projectMeasure',
  contract: 'v2.leadInfo.projectContract',
} as const;

function toneColor(tone: V2ProjectTimelineTone): string {
  if (tone === 'ink') return 'var(--v2-ink)';
  if (tone === 'faint') return 'var(--v2-faint)';
  return V2_PROJECT_STATUS_COLOR[tone];
}

// Timeline of Project card v4 (owner decisions 2026-11-14): events only, one short line each —
// title, a few facts, author and time ("Comment added · Name"). Comments themselves are read in
// the Statuses & tasks tab; another event's note shows clipped at the end of its line.
@Component({
  selector: 'app-v2-project-timeline',
  imports: [TranslatePipe, V2Button],
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
        <ol class="v2-project-timeline__lines">
          @for (entry of entries(); track entry.id) {
            <li class="v2-project-timeline__line">
              <span
                class="v2-project-timeline__dot"
                [style.background]="entry.color"
                aria-hidden="true"
              ></span>
              <span class="v2-project-timeline__text" [attr.title]="entry.full">
                <span class="v2-project-timeline__event">{{ entry.title }}</span>
                @for (fact of entry.facts; track $index) {
                  <span class="v2-project-timeline__fact"> · {{ fact }}</span>
                }
                <span class="v2-project-timeline__author"> · {{ entry.author }}</span>
                @if (entry.note) {
                  <span class="v2-project-timeline__note"> — {{ entry.note }}</span>
                }
              </span>
              <time class="v2-project-timeline__time" [attr.datetime]="entry.at">
                {{ entry.date }}, {{ entry.time }}
              </time>
            </li>
          } @empty {
            <li class="v2-project-timeline__status">
              {{ 'v2.projectCard.timeline.empty' | translate }}
            </li>
          }
        </ol>
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
      const facts: string[] = [];
      if (item.change) {
        facts.push(
          `${this.i18n.t(v2ProjectStatusLabelKey(item.change.from))} → ${this.i18n.t(
            v2ProjectStatusLabelKey(item.change.to),
          )}`,
        );
      }
      for (const row of item.rows) facts.push(this.rowValue(row.value));
      if (item.leadCode) facts.push(item.leadCode);
      // A comment is read in the Statuses & tasks tab; other notes are clipped on the line.
      const note = item.type === 'comment' ? null : item.text;
      const title = this.i18n.t(item.titleKey);
      const author = item.actorName ?? this.i18n.t('v2.card.system');
      return {
        id: item.id,
        at: item.at,
        date: formatV2CardDate(item.at, this.now(), locale),
        time: formatV2Time(item.at),
        title,
        facts,
        author,
        note,
        color: toneColor(item.tone),
        full: [title, ...facts, author].join(' · ') + (note ? ` — ${note}` : ''),
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
      case 'removed':
        return this.i18n.t('v2.projectCard.event.removed');
      case 'basis':
        return this.i18n.t(V2_PAYMENT_BASIS_LABEL[value.basis]);
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
      case 'dateTime':
        return `${formatV2CardDate(value.at, this.now(), locale)}, ${formatV2Time(value.at)}`;
    }
  }

  private person(personId: string): string {
    return this.personName()(personId) ?? this.i18n.t('common.unassigned');
  }
}
