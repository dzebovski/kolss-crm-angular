import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money } from '@domain/v2/project-money';
import { v2ProjectStatusLabelKey } from '@domain/v2/project-status';
import type { V2Project, V2ProjectCancelReason } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2ChipGroup } from '../../ui/v2-chip-group';
import { V2_CANCEL_REASON_LABEL } from '../card/v2-project-cancel-banner';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectCancelData {
  readonly project: V2Project;
}

interface CancelModel {
  reasons: readonly string[];
  comment: string;
  dropEvents: boolean;
}

const REASONS: readonly V2ProjectCancelReason[] = [
  'chose_another_supplier',
  'price_too_high',
  'postponed_renovation',
  'disagreed_design',
  'not_relevant',
  'other',
];

const COMMENT_MAX = 1000;

// Cancel project (Project-cancel board, pipeline 3): reasons (one or more) and a required
// detailed comment for every reason (owner decision 2026-11-07), optional removal of the future
// calendar events, a warning when money was already received. The stage it was cancelled from is
// saved by the API for Restore. Closes with the updated project.
@Component({
  selector: 'app-v2-project-cancel-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2ChipGroup,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2ProjectNotice,
  ],
  template: `
    @let errors = shown();
    <app-v2-dialog
      [title]="'v2.projectCard.cancel' | translate"
      [subtitle]="subtitle"
      width="status"
      [hint]="hint()"
      [cancelLabel]="'v2.projectPopup.cancelKeep' | translate"
      [saveLabel]="'v2.projectCard.cancel' | translate"
      primaryVariant="danger"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="errorCount()"
      [hasUnsavedInput]="hasUnsavedInput()"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <app-v2-project-notice tone="danger">{{ message }}</app-v2-project-notice>
      }
      @if (paidWarning(); as text) {
        <app-v2-project-notice>{{ text }}</app-v2-project-notice>
      }
      <app-v2-field-group
        [label]="'v2.projectCard.row.reasons' | translate"
        [required]="true"
        [hint]="'v2.projectPopup.cancel.reasonsHint' | translate"
        [error]="errors.reasons ?? ''"
      >
        <app-v2-chip-group
          [ariaLabel]="'v2.projectCard.row.reasons' | translate"
          [options]="reasonOptions"
          [formField]="fields.reasons"
        />
      </app-v2-field-group>
      <app-v2-form-field
        [label]="'v2.timeline.comment' | translate"
        [required]="true"
        [hint]="'v2.projectPopup.cancel.commentHint' | translate"
        [error]="errors.comment ?? ''"
      >
        <textarea
          rows="4"
          [placeholder]="'v2.projectPopup.cancel.commentPlaceholder' | translate"
          [formField]="fields.comment"
        ></textarea>
      </app-v2-form-field>
      <label class="v2-cancel-popup__check">
        <input type="checkbox" [formField]="fields.dropEvents" />
        {{ 'v2.projectPopup.cancel.dropEvents' | translate }}
      </label>
    </app-v2-dialog>
  `,
  styles: `
    .v2-cancel-popup__check {
      display: flex;
      align-items: center;
      gap: var(--v2-space-2);
      font-size: 14px;
      cursor: pointer;

      input {
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: var(--v2-ink);
      }
    }
  `,
})
export class V2ProjectCancelDialog {
  private readonly dialogRef = inject<DialogRef<V2Project | null>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2ProjectCancelData>(DIALOG_DATA);

  private readonly project = this.data.project;
  protected readonly subtitle = `${this.project.code} · ${this.project.clientName}`;
  protected readonly reasonOptions = REASONS.map((id) => ({
    id,
    label: this.i18n.t(V2_CANCEL_REASON_LABEL[id]),
  }));

  protected readonly model = signal<CancelModel>({ reasons: [], comment: '', dropEvents: false });
  protected readonly fields = form(this.model);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);

  /** Money already received: refunds happen outside the CRM (Project-cancel board). */
  protected readonly paidWarning = computed(() => {
    const paid = this.project.paidTotals
      .filter((money) => money.amount > 0)
      .map((money) => formatV2Money(money, this.i18n.locale()));
    return paid.length
      ? this.i18n.t('v2.projectPopup.cancel.paid', { amount: paid.join(' + ') })
      : null;
  });

  private readonly errors = computed(() => {
    const value = this.model();
    const errors: Partial<Record<'reasons' | 'comment', string>> = {};
    if (!value.reasons.length) errors.reasons = this.i18n.t('v2.projectPopup.cancel.pickReason');
    if (!value.comment.trim()) errors.comment = this.i18n.t('v2.projectPopup.cancel.describe');
    else if (value.comment.trim().length > COMMENT_MAX)
      errors.comment = this.i18n.t('v2.projectCard.commentTooLong', { max: COMMENT_MAX });
    return errors;
  });

  protected readonly invalid = computed(() => Object.keys(this.errors()).length > 0);
  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);
  protected readonly shown = computed(() => (this.touched() ? this.errors() : {}));
  protected readonly hasUnsavedInput = computed(
    () => this.model().reasons.length > 0 || this.model().comment.trim() !== '',
  );
  protected readonly hint = computed(() =>
    this.i18n.t(
      this.model().dropEvents
        ? 'v2.projectPopup.cancel.eventsRemoved'
        : 'v2.projectPopup.cancel.eventsKept',
      { status: this.i18n.t(v2ProjectStatusLabelKey(this.project.status)) },
    ),
  );

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const value = this.model();
    this.saving.set(true);
    this.error.set('');
    try {
      const project = await this.projects.cancel(this.project.id, {
        reasons: REASONS.filter((reason) => value.reasons.includes(reason)),
        comment: value.comment.trim(),
        cancelFutureEvents: value.dropEvents,
      });
      this.dialogRef.close(project);
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
