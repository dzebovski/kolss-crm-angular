import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, maxLength, required } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2Project } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';

export interface V2ProjectCommentData {
  readonly projectId: string;
  /** "W0231 · Kowalski" under the title. */
  readonly subtitle: string;
}

/** `AddProjectCommentRequest.text`: 1–1000 characters. */
const MAX_LENGTH = 1000;

// Add comment on the Project card: the lead's Add-comment popup without the reminder part (the
// project API has no reminder or task on a comment). Closes with the updated project after a save.
@Component({
  selector: 'app-v2-project-comment-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      [title]="'v2.comment.title' | translate"
      [subtitle]="data.subtitle"
      width="form"
      [hint]="'v2.comment.footerNote' | translate"
      [cancelLabel]="'v2.comment.cancel' | translate"
      [saveLabel]="'v2.comment.save' | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="invalid() ? 1 : 0"
      [hasUnsavedInput]="model().text.trim() !== ''"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <p class="v2-project-comment__error" role="alert">{{ message }}</p>
      }
      <app-v2-form-field
        [label]="'v2.timeline.comment' | translate"
        [required]="true"
        [hint]="'v2.projectCard.commentHint' | translate"
        [error]="textError()"
      >
        <textarea
          cdkFocusInitial
          rows="4"
          [placeholder]="'v2.projectCard.commentPlaceholder' | translate"
          [formField]="comment.text"
        ></textarea>
      </app-v2-form-field>
    </app-v2-dialog>
  `,
  styles: `
    .v2-project-comment__error {
      margin: 0;
      padding: 10px var(--v2-space-3);
      background: var(--v2-danger-bg);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-danger);
      font-size: 13px;
      font-weight: 500;
    }
  `,
})
export class V2ProjectCommentDialog {
  private readonly dialogRef = inject<DialogRef<V2Project | null>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2ProjectCommentData>(DIALOG_DATA);

  protected readonly model = signal({ text: '' });
  protected readonly comment = form(this.model, (path) => {
    required(path.text);
    maxLength(path.text, MAX_LENGTH);
  });
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);
  protected readonly invalid = computed(() => {
    const text = this.model().text.trim();
    return !text || text.length > MAX_LENGTH;
  });
  protected readonly textError = computed(() =>
    !this.touched() || !this.invalid()
      ? ''
      : this.model().text.trim()
        ? this.i18n.t('v2.projectCard.commentTooLong', { max: MAX_LENGTH })
        : this.i18n.t('v2.dialog.fieldRequired'),
  );
  /** One key per popup, so a retried save after a lost response is not stored twice. */
  private readonly idempotencyKey = crypto.randomUUID();

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const project = await this.projects.addComment(
        this.data.projectId,
        { text: this.model().text.trim() },
        this.idempotencyKey,
      );
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
