import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import type { LeadEventCorrectionType } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { Lead, LeadEvent } from '@domain/lead.types';
import { formatV2ReminderDate, formatV2Time } from '@domain/v2/date-format';
import { v2IsoToLocalDateTime, v2LocalDateTimeToIso } from '@domain/v2/lead-action';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import type { V2LeadColumns } from '@domain/v2/lead-card.types';
import {
  V2_CORRECTION_TYPES,
  v2CorrectionNeedsDate,
  v2EventCorrectionDueAt,
  v2EventCorrectionType,
  v2TimelineCorrectionRequest,
} from '@domain/v2/timeline-correction';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2DateTimeInput } from '../../ui/v2-date-time-input';

export interface V2EditEntryData {
  readonly lead: Lead;
  readonly columns: V2LeadColumns;
  readonly event: LeadEvent;
  readonly now: Date;
  /** Whether W12 will let the lead status follow a type correction for this entry. */
  readonly statusWillFollow: boolean;
}

interface EditEntryModel {
  type: LeadEventCorrectionType;
  comment: string;
  dueAt: string;
  reason: string;
}

const TYPE_LABEL: Record<LeadEventCorrectionType, MessageKey> = {
  success: 'v2.status.success',
  later: 'v2.status.later',
  noanswer: 'v2.status.noanswer',
  thinking: 'v2.status.thinking',
  comment: 'v2.timeline.comment',
};

@Component({
  selector: 'app-v2-edit-entry-dialog',
  imports: [FormField, TranslatePipe, V2DateTimeInput, V2DialogShell, V2FormField],
  templateUrl: './v2-edit-entry-dialog.html',
  styleUrl: './v2-edit-entry-dialog.scss',
})
export class V2EditEntryDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2EditEntryData>(DIALOG_DATA);

  private readonly originalType = v2EventCorrectionType(this.data.event)!;
  private readonly originalComment = this.data.event.comment?.trim() ?? '';
  private readonly originalDueAt = v2EventCorrectionDueAt(this.data.event);
  private readonly initial: EditEntryModel = {
    type: this.originalType,
    comment: this.originalComment,
    dueAt: v2IsoToLocalDateTime(this.originalDueAt),
    reason: '',
  };

  protected readonly leadContext = computed(() => toV2LeadCard(this.data.lead, this.data.columns));
  protected readonly typeLabels = TYPE_LABEL;
  protected readonly types = V2_CORRECTION_TYPES;
  protected readonly model = signal<EditEntryModel>({ ...this.initial });
  protected readonly entry = form(this.model);
  protected readonly attempted = signal(false);
  protected readonly dateTouched = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  protected readonly typeChanged = computed(() => this.model().type !== this.originalType);
  protected readonly commentChanged = computed(
    () => this.model().comment.trim() !== this.originalComment,
  );
  protected readonly changed = computed(() => this.typeChanged() || this.commentChanged());
  protected readonly needsDate = computed(
    () => this.typeChanged() && v2CorrectionNeedsDate(this.model().type),
  );
  private readonly dueIso = computed(() => v2LocalDateTimeToIso(this.model().dueAt));
  private readonly dateInvalid = computed(
    () => this.needsDate() && (!this.dueIso() || new Date(this.dueIso()!) <= this.data.now),
  );
  protected readonly commentError = computed(() =>
    this.attempted() && !this.model().comment.trim()
      ? this.i18n.t('v2.timelineCorrection.commentRequired')
      : '',
  );
  protected readonly dateError = computed(() =>
    (this.attempted() || this.dateTouched()) && this.dateInvalid()
      ? this.i18n.t('v2.timelineCorrection.dateRequired')
      : '',
  );
  protected readonly reasonError = computed(() =>
    this.attempted() && this.changed() && !this.model().reason.trim()
      ? this.i18n.t('v2.timelineCorrection.reasonRequired')
      : '',
  );
  protected readonly errorCount = computed(
    () =>
      Number(!this.model().comment.trim()) +
      Number(this.dateInvalid()) +
      Number(this.changed() && !this.model().reason.trim()),
  );
  protected readonly invalid = computed(() => this.errorCount() > 0);
  protected readonly hasUnsavedInput = computed(() =>
    Boolean(
      this.changed() || this.model().reason.trim() || this.model().dueAt !== this.initial.dueAt,
    ),
  );
  protected readonly statusChanges = computed(
    () => this.data.statusWillFollow && this.typeChanged(),
  );
  protected readonly originalLabel = computed(() => this.i18n.t(TYPE_LABEL[this.originalType]));
  protected readonly originalWhen = computed(
    () =>
      `${formatV2ReminderDate(this.data.event.occurredAt, this.data.now, this.i18n.locale())}, ${formatV2Time(this.data.event.occurredAt)}`,
  );
  protected readonly dueLabel = computed(() =>
    this.model().type === 'later'
      ? this.i18n.t('v2.popup.later.date')
      : this.model().type === 'noanswer'
        ? this.i18n.t('v2.popup.noanswer.date')
        : this.i18n.t('v2.popup.thinking.date'),
  );

  protected selectType(type: LeadEventCorrectionType): void {
    this.model.update((value) => ({
      ...value,
      type,
      dueAt:
        type === this.originalType && this.originalDueAt
          ? v2IsoToLocalDateTime(this.originalDueAt)
          : value.dueAt,
    }));
  }

  protected setDueAt(dueAt: string): void {
    this.model.update((value) => ({ ...value, dueAt }));
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const value = this.model();
    const request = v2TimelineCorrectionRequest(
      { type: this.originalType, comment: this.originalComment },
      { ...value, dueAt: this.needsDate() ? (this.dueIso() ?? '') : '' },
    );
    if (!request) {
      this.dialogRef.close(false);
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.service.correctEntry(this.data.lead.id, this.data.event.id, request);
      this.dialogRef.close(true);
    } catch (error) {
      this.saveError.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}

export interface V2DeleteEntryData {
  /** v1 warns that office-work entries also remove the linked calendar work. */
  readonly officeWork: boolean;
}

@Component({
  selector: 'app-v2-delete-entry-dialog',
  imports: [TranslatePipe, V2DialogShell],
  template: `
    <app-v2-dialog
      [title]="'leadDetail.deleteEventTitle' | translate"
      width="status"
      [saveLabel]="'leadDetail.deleteEventConfirmButton' | translate"
      primaryVariant="danger"
      (save)="dialogRef.close(true)"
    >
      <p class="v2-delete-entry__text">
        {{
          (data.officeWork
            ? 'leadDetail.deleteOfficeWorkEventConfirm'
            : 'leadDetail.deleteEventConfirm'
          ) | translate
        }}
      </p>
    </app-v2-dialog>
  `,
  styles: `
    .v2-delete-entry__text {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
  `,
})
export class V2DeleteEntryDialog {
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<V2DeleteEntryData>(DIALOG_DATA);
}
