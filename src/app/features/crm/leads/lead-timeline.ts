import { Component, inject, input, output, signal } from '@angular/core';

import { presentHistoryAuditText } from '@core/i18n/event-presenter';
import { I18nService } from '@core/i18n/i18n.service';
import { callStatusTone, clientStatusTone } from '@domain/lead.rules';
import type { LeadEvent } from '@domain/lead.types';
import { UiButton } from '@ui/button/ui-button';
import { UiModal } from '@ui/dialog/ui-modal';
import type { UiBadgeTone } from '@ui/feedback/ui-badge';
import { UiBadge } from '@ui/feedback/ui-badge';
import { UiIcon } from '@ui/icon/ui-icon';
import { LinkifiedText } from '@ui/text/linkified-text';
import { UiUser } from '@ui/user/ui-user';
import { LeadDueDate, type LeadDueDateKind } from './lead-due-date';
import * as presenter from './lead-detail-page.presenter';

/**
 * Presentational history/timeline panel for a lead. Owns only the local,
 * per-event UI state (delete confirmation, translation pending/error) —
 * every mutation is delegated to the caller: `editRequested`/`deleteConfirmed`
 * are plain notifications, and `translateEvent` is a caller-supplied async
 * function this component awaits and reports errors for. Permission is a
 * single `canMutate` predicate supplied by the parent, which is the only
 * place that consults `@core/policy/lead.policy` — this component never
 * imports policy itself.
 */
@Component({
  selector: 'app-lead-timeline',
  imports: [LeadDueDate, LinkifiedText, UiBadge, UiButton, UiIcon, UiModal, UiUser],
  templateUrl: './lead-timeline.html',
  styleUrl: './lead-timeline.scss',
})
export class LeadTimeline {
  protected readonly i18n = inject(I18nService);

  readonly events = input<readonly LeadEvent[]>([]);
  readonly canMutate = input.required<(event: LeadEvent) => boolean>();
  readonly employeeName = input.required<(id: string | null) => string>();
  readonly pending = input(false);
  readonly error = input('');
  readonly translateEvent = input.required<(event: LeadEvent) => Promise<void>>();

  readonly editRequested = output<LeadEvent>();
  readonly deleteConfirmed = output<LeadEvent>();

  protected readonly deleteTarget = signal<LeadEvent | null>(null);
  protected readonly translatingIds = signal<ReadonlySet<string>>(new Set());
  protected readonly translationErrors = signal<Readonly<Record<string, string>>>({});

  protected eventTitle(event: LeadEvent): string {
    return presenter.eventTitle(event, this.i18n.activeBundle());
  }

  protected eventStatusLabel(event: LeadEvent): string {
    return presenter.eventStatusLabel(event, {
      callStatusLabel: (status) => this.i18n.callStatusLabel(status),
      clientStatusLabel: (status) => this.i18n.clientStatusLabel(status),
    });
  }

  protected eventStatusTone(event: LeadEvent): UiBadgeTone {
    return presenter.eventStatusTone(event, { callStatusTone, clientStatusTone });
  }

  protected eventBody(event: LeadEvent): string {
    return presenter.eventBody(event, this.i18n.activeBundle(), this.eventStatusLabel(event));
  }

  protected eventDueDate(
    event: LeadEvent,
  ): { readonly date: string; readonly kind: LeadDueDateKind } | null {
    return presenter.eventDueDate(event);
  }

  protected eventActorName(event: LeadEvent): string {
    return event.actorName?.trim() || this.employeeName()(event.actorId || null);
  }

  protected eventAssigneeName(event: LeadEvent): string {
    return this.employeeName()(event.assignedToId ?? null);
  }

  protected eventAuditText(event: LeadEvent): string {
    return presentHistoryAuditText(event, this.i18n.activeBundle(), (value) =>
      this.i18n.formatDateTime(value),
    );
  }

  protected editEvent(event: LeadEvent): void {
    if (!this.canMutate()(event)) return;
    this.editRequested.emit(event);
  }

  protected askDelete(event: LeadEvent): void {
    if (!this.canMutate()(event)) return;
    this.deleteTarget.set(event);
  }

  protected cancelDelete(): void {
    if (this.pending()) return;
    this.deleteTarget.set(null);
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target || !this.canMutate()(target)) return;
    this.deleteConfirmed.emit(target);
    this.deleteTarget.set(null);
  }

  protected isEventTranslationPending(eventId: string): boolean {
    return this.translatingIds().has(eventId);
  }

  protected translationError(eventId: string): string {
    return this.translationErrors()[eventId] ?? '';
  }

  protected async translate(event: LeadEvent): Promise<void> {
    if (this.isEventTranslationPending(event.id) || !event.comment?.trim() || event.translationEn) {
      return;
    }
    this.translationErrors.update((errors) => {
      if (!(event.id in errors)) return errors;
      const next = { ...errors };
      delete next[event.id];
      return next;
    });
    this.translatingIds.update((ids) => new Set(ids).add(event.id));
    try {
      await this.translateEvent()(event);
    } catch {
      this.translationErrors.update((errors) => ({
        ...errors,
        [event.id]: this.i18n.t('leadDetail.translationFailed'),
      }));
    } finally {
      this.translatingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(event.id);
        return next;
      });
    }
  }
}
