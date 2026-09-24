import { Component, computed, inject, input, output, signal } from '@angular/core';

import {
  presentEventBodyFromLeadEvent,
  presentEventTitleFromLeadEvent,
} from '@core/i18n/event-presenter';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { ContractCurrency, LeadEvent } from '@domain/lead.types';
import {
  formatV2CardDate,
  formatV2ReminderDate,
  formatV2Time,
  formatV2TimeRange,
} from '@domain/v2/date-format';
import { formatV2Budget } from '@domain/v2/lead-card.mapper';
import {
  matchesV2TimelineFilter,
  type V2TimelineFilter,
  type V2TimelineItem,
  type V2TimelineRowLabel,
  type V2TimelineRowValue,
  type V2TimelineSide,
  type V2TimelineTitle,
} from '@domain/v2/lead-timeline';
import { V2_CHANNEL_LABEL, V2_PRODUCT_LABEL } from '../../ui/v2-lead-labels';
import { V2TimelineEntry, type V2TimelineChangeSide } from '../../ui/v2-timeline-entry';
import { V2_RATING_LABEL, V2_STATUS_LABEL } from '../../ui/v2-tone';

const FILTERS: readonly { readonly id: V2TimelineFilter; readonly label: MessageKey }[] = [
  { id: 'all', label: 'v2.timeline.filter.all' },
  { id: 'call', label: 'v2.timeline.filter.calls' },
  { id: 'status', label: 'v2.timeline.filter.status' },
  { id: 'comment', label: 'v2.timeline.filter.comments' },
];

const TITLE_KEY: Record<Extract<V2TimelineTitle, { kind: 'key' }>['key'], MessageKey> = {
  leadInfoUpdated: 'v2.timeline.leadInfoUpdated',
  firstMessage: 'v2.timeline.firstMessage',
  leadCreated: 'v2.timeline.leadCreated',
  lost: 'v2.timeline.lost',
  rating: 'v2.timeline.rating',
  comment: 'v2.timeline.comment',
  question: 'v2.timeline.question',
  contactUpdated: 'v2.timeline.contactUpdated',
};

const ROW_LABEL: Record<V2TimelineRowLabel, MessageKey> = {
  attempt: 'v2.current.attempt',
  nextAttempt: 'v2.current.nextAttempt',
  callBack: 'v2.current.callBack',
  budget: 'v2.timeline.budget',
  product: 'v2.card.product',
  location: 'v2.card.location',
  nextAction: 'v2.current.nextAction',
  followUp: 'v2.current.followUp',
  when: 'v2.current.when',
  designer: 'v2.current.designer',
  calendar: 'v2.timeline.calendar',
  reason: 'v2.current.reason',
  reminder: 'v2.timeline.reminder',
  assignedTo: 'v2.timeline.assignedTo',
  channel: 'v2.editContact.channel',
  answer: 'v2.timeline.answer',
  materials: 'v2.timeline.materials',
  leadTime: 'v2.timeline.leadTime',
  measurement: 'v2.timeline.measurement',
};

// Timeline card from lead card v1.3: title + All / Calls / Status / Comments filter with counts,
// then TimelineEntry rows. Edit, delete and translate work as in v1 (decision D6); their
// placement is not drawn, so they are small text actions under the entry. Presentational: the
// page runs the requests.
@Component({
  selector: 'app-v2-lead-timeline',
  imports: [TranslatePipe, V2TimelineEntry],
  templateUrl: './v2-lead-timeline.html',
  styleUrl: './v2-lead-timeline.scss',
})
export class V2LeadTimeline {
  private readonly i18n = inject(I18nService);

  readonly items = input.required<readonly V2TimelineItem[]>();
  readonly now = input.required<Date>();
  /** Display name of a user id; null when unknown. */
  readonly personName = input.required<(id: string) => string | null>();
  readonly canMutate = input.required<(event: LeadEvent) => boolean>();
  readonly pending = input(false);
  /** Event ids whose translation is being requested. */
  readonly translating = input<ReadonlySet<string>>(new Set());
  readonly editRequested = output<LeadEvent>();
  readonly deleteRequested = output<LeadEvent>();
  readonly translateRequested = output<LeadEvent>();

  protected readonly filter = signal<V2TimelineFilter>('all');

  protected readonly tabs = computed(() =>
    FILTERS.map((tab) => ({
      ...tab,
      count: this.items().filter((item) => matchesV2TimelineFilter(item, tab.id)).length,
    })),
  );

  protected readonly entries = computed(() => {
    const now = this.now();
    const locale = this.i18n.locale();
    const canMutate = this.canMutate();
    return this.items()
      .filter((item) => matchesV2TimelineFilter(item, this.filter()))
      .map((item) => {
        const event = item.event;
        const mutable = Boolean(event && canMutate(event));
        return {
          id: item.id,
          event,
          date: formatV2CardDate(item.at, now, locale),
          time: formatV2Time(item.at),
          title: this.title(item),
          author: this.author(item),
          tone: item.tone,
          change: item.change
            ? { from: this.side(item.change.from), to: this.side(item.change.to) }
            : null,
          quote: item.quote,
          rows: item.rows.map((row) => ({
            key: this.i18n.t(ROW_LABEL[row.label]),
            value: this.value(row.value),
          })),
          text: this.text(item),
          translation: event?.translationEn ?? null,
          canEdit: mutable && !event?.question,
          canDelete: mutable,
          canTranslate: Boolean(event?.comment?.trim() && !event.translationEn),
        };
      });
  });

  private title(item: V2TimelineItem): string {
    switch (item.title.kind) {
      case 'status':
        return this.i18n.t(V2_STATUS_LABEL[item.title.status]);
      case 'key':
        return this.i18n.t(TITLE_KEY[item.title.key]);
      case 'v1':
        return item.event
          ? presentEventTitleFromLeadEvent(item.event, this.i18n.activeBundle())
          : '';
    }
  }

  private text(item: V2TimelineItem): string | null {
    if (item.changedFields) {
      if (!item.changedFields.length) return null;
      const fields = item.changedFields.map((field) => capitalize(this.i18n.fieldLabel(field)));
      return this.i18n.t('v2.timeline.changed', { fields: fields.join(', ') });
    }
    if (item.title.kind === 'v1' && item.event) {
      return presentEventBodyFromLeadEvent(item.event, this.i18n.activeBundle()) || null;
    }
    return item.text;
  }

  private author(item: V2TimelineItem): string {
    if (item.form === 'meta') return this.i18n.t('v2.timeline.metaForm');
    if (item.form === 'website') return this.i18n.t('v2.timeline.websiteForm');
    return (
      item.actorName ||
      (item.actorId ? this.personName()(item.actorId) : null) ||
      this.i18n.t('v2.card.system')
    );
  }

  private side(side: V2TimelineSide): V2TimelineChangeSide {
    if (side.kind === 'status') {
      return { label: this.i18n.t(V2_STATUS_LABEL[side.status]), tone: side.status };
    }
    return side.rating
      ? { label: this.i18n.t(V2_RATING_LABEL[side.rating]), tone: side.rating }
      : { label: this.i18n.t('v2.rating.none'), tone: null };
  }

  private value(value: V2TimelineRowValue): string {
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
      case 'lossReason':
        return this.i18n.closeReasonLabel(value.code);
      case 'budget':
        return value.currency
          ? formatV2Budget(
              { amount: value.amount, currency: value.currency as ContractCurrency },
              locale,
            )
          : value.amount;
      case 'products':
        return value.products.map((product) => this.i18n.t(V2_PRODUCT_LABEL[product])).join(', ');
      case 'channel':
        return this.i18n.t(V2_CHANNEL_LABEL[value.channel]);
      case 'eventCreated':
        return this.i18n.t('v2.timeline.eventCreated');
      case 'office':
      case 'notSet':
        return this.i18n.t('v2.card.notSet');
    }
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
