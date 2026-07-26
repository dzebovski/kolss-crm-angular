/**
 * Pure derivation/formatting helpers extracted from `LeadDetailView` and its
 * sub-components. Nothing here touches Angular DI or signals, so every
 * function is testable with plain data in `lead-detail-page.presenter.spec.ts`
 * (no `TestBed`) — see best-practices.md's guidance to move derived state and
 * formatting out of components that grow too large.
 */
import {
  presentEventBodyFromLeadEvent,
  presentEventTitleFromLeadEvent,
} from '@core/i18n/event-presenter';
import type { MessageBundle } from '@core/i18n/messages';
import { callbackDueAtFromNewValue, leadIsInWork } from '@domain/lead.rules';
import type { CallStatus, ClientStatus, Lead, LeadEvent } from '@domain/lead.types';
import type { UserRole } from '@models/database';
import type { UiBadgeTone } from '@ui/feedback/ui-badge';
import type { UiSelectOption } from '@ui/form/ui-select';
import type { LeadDueDateKind } from './lead-due-date';

export function isCallStatus(value: string | null | undefined): value is CallStatus {
  return value === 'reached' || value === 'no_answer' || value === 'callback_requested';
}

export function isClientStatus(value: string | null | undefined): value is ClientStatus {
  return (
    value === 'new_lead' ||
    value === 'showroom_invited' ||
    value === 'calculation_in_progress' ||
    value === 'thinking' ||
    value === 'closed_lost' ||
    value === 'contract_signed'
  );
}

export interface StatusLabelFns {
  readonly callStatusLabel: (status: CallStatus) => string;
  readonly clientStatusLabel: (status: ClientStatus) => string;
}

export interface StatusToneFns {
  readonly callStatusTone: (status: CallStatus | null) => UiBadgeTone;
  readonly clientStatusTone: (status: ClientStatus) => UiBadgeTone;
}

/** The badge text for a timeline event's recorded call/client status, if any. */
export function eventStatusLabel(event: LeadEvent, labels: StatusLabelFns): string {
  if (!event.statusCode) return '';
  if (event.category === 'call_status') {
    return isCallStatus(event.statusCode)
      ? labels.callStatusLabel(event.statusCode)
      : event.statusCode;
  }
  if (event.category === 'client_status' || event.category === 'system') {
    return isClientStatus(event.statusCode)
      ? labels.clientStatusLabel(event.statusCode)
      : event.statusCode;
  }
  return '';
}

/** The badge tone for a timeline event's recorded call/client status. */
export function eventStatusTone(event: LeadEvent, tones: StatusToneFns): UiBadgeTone {
  if (event.category === 'call_status' && isCallStatus(event.statusCode)) {
    return tones.callStatusTone(event.statusCode);
  }
  if (
    (event.category === 'client_status' || event.category === 'system') &&
    isClientStatus(event.statusCode)
  ) {
    return tones.clientStatusTone(event.statusCode);
  }
  return 'neutral';
}

/** The event's rendered title, falling back to the untranslated event body when no status badge applies. */
export function eventTitle(event: LeadEvent, bundle: MessageBundle | null): string {
  return presentEventTitleFromLeadEvent(event, bundle);
}

/** The event's body text, or '' when a status badge already carries the comment. */
export function eventBody(
  event: LeadEvent,
  bundle: MessageBundle | null,
  statusLabel: string,
): string {
  if (statusLabel) return event.comment?.trim() ?? '';
  return presentEventBodyFromLeadEvent(event, bundle);
}

/** The due date (callback/thinking/showroom) attached to a timeline event, if any. */
export function eventDueDate(
  event: LeadEvent,
): { readonly date: string; readonly kind: LeadDueDateKind } | null {
  const date = callbackDueAtFromNewValue(event.newValue);
  if (!date) return null;
  const isComment =
    event.category === 'comment' || event.type === 'comment' || event.type === 'comment_added';
  const isScheduledStatus =
    (event.category === 'call_status' && event.statusCode === 'callback_requested') ||
    (event.category === 'client_status' &&
      (event.statusCode === 'thinking' || event.statusCode === 'showroom_invited'));
  if (!isComment && !isScheduledStatus) return null;
  return { date, kind: isComment ? 'comment' : 'status' };
}

/** "В роботі" for a still-new lead that already has a call recorded, else the plain client-status label. */
export function clientStatusLabelForLead(
  lead: Lead,
  clientStatusLabel: (status: ClientStatus) => string,
  workflowTakenLabel: string,
): string {
  return leadIsInWork(lead) ? workflowTakenLabel : clientStatusLabel(lead.clientStatus);
}

/** The one-line "Closed - reason - comment" summary shown once a lead is closed_lost. */
export function closeSummaryLine(
  lead: Pick<Lead, 'close'>,
  closedLabel: string,
  closeReasonLabel: (code: string) => string,
): string {
  if (!lead.close) return '';
  const parts = [
    closedLabel,
    closeReasonLabel(lead.close.reason),
    lead.close.comment.trim(),
  ].filter(Boolean);
  return parts.join(' - ');
}

export interface StaffLike {
  readonly id: string;
  readonly displayName: string;
  readonly status: 'active' | 'inactive';
  readonly role: UserRole;
  readonly officeIds: readonly string[];
}

/**
 * Active, non-super-admin staff of `officeCode`, as select options, with
 * `placeholder` first. Shared by the comment-assignee picker and the
 * manager-assignment picker, which only differ in their placeholder option.
 */
export function activeOfficeStaffOptions(
  employees: readonly StaffLike[],
  officeCode: string,
  isSuperAdminRole: (role: UserRole) => boolean,
  placeholder: UiSelectOption,
): readonly UiSelectOption[] {
  const staff = employees
    .filter(
      (employee) =>
        employee.status === 'active' &&
        !isSuperAdminRole(employee.role) &&
        employee.officeIds.includes(officeCode),
    )
    .map((employee) => ({ value: employee.id, label: employee.displayName, userId: employee.id }));
  return [placeholder, ...staff];
}
