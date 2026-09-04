import { Component, computed, inject, input } from '@angular/core';

import type { Appointment, AppointmentStatus } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import type { Lead } from '@domain/lead.types';
import { LeadReference } from '@features/crm/leads/lead-reference';
import { UiIcon, type UiIconName } from '@ui/icon/ui-icon';

export type CalendarEventKind =
  Appointment['kind'] | 'callback' | 'thinking' | 'postponed' | 'comment' | 'task';

export type CalendarEventCardDensity = 'full' | 'compact' | 'month';

export interface CalendarEventCardModel {
  readonly kind: CalendarEventKind;
  readonly time: string | null;
  readonly lead: Pick<Lead, 'id' | 'referenceId' | 'name' | 'phone'>;
  readonly managerName: string;
  readonly comment: string | null;
  readonly status: AppointmentStatus | null;
  readonly hasWarning: boolean;
}

const EVENT_ICON: Record<CalendarEventKind, UiIconName> = {
  showroom: 'storefront',
  measurement: 'straighten',
  office_work: 'business_center',
  callback: 'phone_in_talk',
  thinking: 'handshake',
  postponed: 'snooze',
  comment: 'chat_bubble',
  task: 'assignment_ind',
};

const EVENT_LABEL: Record<CalendarEventKind, MessageKey> = {
  showroom: 'calendar.kind.showroom',
  measurement: 'calendar.kind.measurement',
  office_work: 'calendar.kind.officeWork',
  callback: 'calendar.kind.callback',
  thinking: 'calendar.kind.thinking',
  postponed: 'calendar.kind.postponed',
  comment: 'calendar.kind.comment',
  task: 'calendar.kind.task',
};

@Component({
  selector: 'app-calendar-event-card',
  imports: [LeadReference, UiIcon],
  templateUrl: './calendar-event-card.html',
  styleUrl: './calendar-event-card.scss',
  host: {
    '[attr.title]': 'accessibleSummary()',
    '[attr.data-event-kind]': 'event().kind',
    '[attr.data-event-status]': 'event().status ?? "base"',
  },
})
export class CalendarEventCard {
  private readonly i18n = inject(I18nService);

  readonly event = input.required<CalendarEventCardModel>();
  readonly density = input<CalendarEventCardDensity>('full');

  protected readonly eventIcon = computed(() => EVENT_ICON[this.event().kind]);
  protected readonly eventLabel = computed(() => this.i18n.t(EVENT_LABEL[this.event().kind]));
  protected readonly isMonth = computed(() => this.density() === 'month');
  protected readonly isCompact = computed(() => this.density() === 'compact');
  protected readonly isTask = computed(() => this.event().kind === 'task');
  protected readonly showFooter = computed(() => !this.isCompact());
  protected readonly hasSemanticState = computed(() => {
    const event = this.event();
    return (event.status !== null && event.status !== 'scheduled') || event.hasWarning;
  });
  protected readonly showTrailingState = computed(() => !this.isTask() || this.hasSemanticState());
  protected readonly showStatusText = computed(() => {
    const event = this.event();
    return (
      !this.isMonth() &&
      ((event.status !== null && event.status !== 'scheduled') || event.hasWarning)
    );
  });
  protected readonly trailingIcon = computed<UiIconName>(() => {
    const event = this.event();
    if (event.status && event.status !== 'scheduled') {
      switch (event.status) {
        case 'visited':
          return 'check_circle';
        case 'no_show':
          return 'person_off';
        case 'canceled':
          return 'cancel';
        case 'rescheduled':
          return 'event_repeat';
      }
    }
    if (event.hasWarning) return 'warning';
    return EVENT_ICON[event.kind];
  });
  protected readonly trailingLabel = computed(() => {
    const event = this.event();
    if (event.status && event.status !== 'scheduled') return this.statusLabel(event.status);
    if (event.hasWarning) return this.i18n.t('calendar.hasWarning');
    return this.eventLabel();
  });
  protected readonly clientName = computed(() => this.event().lead.name || this.event().lead.phone);
  protected readonly accessibleSummary = computed(() => {
    const event = this.event();
    const values = [
      event.time,
      this.eventLabel(),
      event.lead.referenceId,
      this.clientName(),
      event.managerName,
      event.comment,
      this.trailingLabel(),
    ];
    return values.filter((value, index) => value && values.indexOf(value) === index).join('. ');
  });

  protected statusClass(): string {
    const event = this.event();
    if (event.status && event.status !== 'scheduled') return `status-${event.status}`;
    return event.hasWarning ? 'status-warning' : 'status-base';
  }

  private statusLabel(status: Exclude<AppointmentStatus, 'scheduled'>): string {
    if (status === 'visited' && this.event().kind === 'measurement') {
      return this.i18n.t('calendar.measurementCompleted');
    }
    if (status === 'no_show' && this.event().kind === 'measurement') {
      return this.i18n.t('calendar.measurementNoShow');
    }
    const key: Record<Exclude<AppointmentStatus, 'scheduled'>, MessageKey> = {
      visited: 'calendar.visited',
      no_show: 'calendar.noShow',
      canceled: 'calendar.canceled',
      rescheduled: 'calendar.rescheduled',
    };
    return this.i18n.t(key[status]);
  }
}
