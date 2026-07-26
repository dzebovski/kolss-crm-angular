import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '@core/i18n/i18n.service';
import {
  callStatusTone,
  clientStatusToneForLead,
  defaultCurrencyForOffice,
  leadIsTerminal,
  showroomDueAtForLead,
  type LeadActiveReminder,
  type LeadReminderKind,
} from '@domain/lead.rules';
import type { CallStatus, Lead } from '@domain/lead.types';
import type { CalendarAppointmentDeepLink } from '@services/appointments.service';
import { UiButton } from '@ui/button/ui-button';
import { UiBadge } from '@ui/feedback/ui-badge';
import { UiIcon } from '@ui/icon/ui-icon';
import { LinkifiedText } from '@ui/text/linkified-text';
import { UiUser } from '@ui/user/ui-user';
import * as presenter from './lead-detail-page.presenter';
import { LeadDueDate, type LeadDueDateKind } from './lead-due-date';

/**
 * Read-mostly "what is this lead, right now" surface: contact facts, the
 * manager assignment, active reminders, and the call/client status strip.
 * Everything here is display plus small, self-contained formatting (all
 * pure functions from `@domain/lead.rules`/`lead-detail-page.presenter.ts`,
 * or `I18nService` for labels — same pattern as `LeadDueDate`). The two
 * dialog-opening actions (edit lead, assign manager) and clearing a reminder
 * are only ever requested here — `LeadDetailView` still owns the dialogs,
 * the mutation, and the reload/`changed` semantics.
 */
@Component({
  selector: 'app-lead-summary-panel',
  imports: [LeadDueDate, LinkifiedText, RouterLink, UiBadge, UiButton, UiIcon, UiUser],
  templateUrl: './lead-summary-panel.html',
  styleUrl: './lead-summary-panel.scss',
})
export class LeadSummaryPanel {
  protected readonly i18n = inject(I18nService);

  readonly lead = input.required<Lead>();
  readonly employeeName = input.required<(id: string | null) => string>();
  readonly canAssignManager = input(false);
  readonly canEditLead = input(false);
  readonly pending = input(false);
  readonly managerPending = input(false);
  readonly error = input('');
  readonly activeReminders = input<readonly LeadActiveReminder[]>([]);
  readonly calendarAppointmentQuery = input<CalendarAppointmentDeepLink | null>(null);

  readonly editLeadRequested = output<void>();
  readonly assignManagerRequested = output<void>();
  readonly clearReminderRequested = output<LeadActiveReminder>();

  protected readonly isTerminal = leadIsTerminal;
  protected readonly showroomDueAtForLead = showroomDueAtForLead;
  protected readonly callTone = callStatusTone;
  protected readonly clientToneForLead = clientStatusToneForLead;

  protected managerActionLabel(lead: Lead): string {
    return this.i18n.t(lead.assignedToId ? 'lead.replaceManager' : 'lead.assignManager');
  }

  protected sourceLabel(lead: Lead): string {
    return this.i18n.sourceLabel(lead.source);
  }

  protected officeName(code: string): string {
    return this.i18n.officeFilterLabel(code);
  }

  protected defaultCurrency(lead: Lead): string {
    return defaultCurrencyForOffice(lead.officeCode);
  }

  protected formatDateTime(value: string | null | undefined): string {
    return this.i18n.formatDateTime(value);
  }

  protected formatMoney(value: number | null | undefined, currency: string): string {
    return this.i18n.formatMoney(value, currency);
  }

  protected callStatusLabel(status: CallStatus): string {
    return this.i18n.callStatusLabel(status);
  }

  protected clientStatusLabelForLead(lead: Lead): string {
    return presenter.clientStatusLabelForLead(
      lead,
      (status) => this.i18n.clientStatusLabel(status),
      this.i18n.t('workflow.taken'),
    );
  }

  protected reminderLabel(kind: LeadReminderKind): string {
    return this.i18n.t(`leadDetail.reminder.${kind}` as 'leadDetail.reminder.callback');
  }

  protected reminderDueKind(kind: LeadReminderKind): LeadDueDateKind {
    return kind === 'comment' ? 'comment' : 'status';
  }

  protected reminderIcon(
    kind: LeadReminderKind,
  ): 'phone_in_talk' | 'schedule' | 'campaign' | 'calendar_month' {
    switch (kind) {
      case 'callback':
        return 'phone_in_talk';
      case 'thinking':
        return 'schedule';
      case 'comment':
        return 'campaign';
      case 'showroom':
        return 'calendar_month';
    }
  }
}
