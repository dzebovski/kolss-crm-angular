import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { v2LocalDateTimeToIso } from '@domain/v2/lead-action';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';

export interface V2CommentData {
  readonly leadId: string;
}

// Add comment popup from lead card v1.3 (Modal `comment`): Remind on (optional date and time)
// and Comment *. No "Assign to" field (decision D5). Closes with `true` after a save.
// Width 560 (Add-comment.dc.html).
@Component({
  selector: 'app-v2-comment-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      [title]="'v2.comment.title' | translate"
      [subtitle]="'v2.comment.subtitle' | translate"
      width="status"
      [hint]="hint() | translate"
      [saveLabel]="'v2.comment.save' | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="invalid() ? 1 : 0"
      [hasUnsavedInput]="hasUnsavedInput()"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <p class="v2-comment__error" role="alert">{{ message }}</p>
      }
      <app-v2-form-field [label]="'v2.comment.remindOn' | translate">
        <input type="datetime-local" [formField]="comment.remindOn" />
      </app-v2-form-field>
      <app-v2-form-field
        [label]="'v2.timeline.comment' | translate"
        [required]="true"
        [error]="touched() && invalid() ? ('v2.dialog.fieldRequired' | translate) : ''"
      >
        <textarea
          cdkFocusInitial
          rows="3"
          [placeholder]="'v2.popup.commentPlaceholder' | translate"
          [formField]="comment.text"
        ></textarea>
      </app-v2-form-field>
    </app-v2-dialog>
  `,
  styles: `
    .v2-comment__error {
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
export class V2CommentDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2CommentData>(DIALOG_DATA);

  protected readonly model = signal({ text: '', remindOn: '' });
  protected readonly comment = form(this.model, (path) => {
    required(path.text);
  });
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  /** Set once Save is pressed while empty; the comment field only turns red after that. */
  protected readonly touched = signal(false);
  protected readonly invalid = computed(() => !this.model().text.trim());
  protected readonly hasUnsavedInput = computed(
    () => this.model().text.trim() !== '' || this.model().remindOn !== '',
  );

  /** Design footNote: a reminder is created when a date is set, otherwise it's a note. */
  protected readonly hint = computed(() =>
    this.model().remindOn ? 'v2.comment.hintReminder' : 'v2.comment.hintNote',
  );

  protected async save(): Promise<void> {
    const { text, remindOn } = this.model();
    if (this.saving() || !text.trim()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.service.addComment(this.data.leadId, text, v2LocalDateTimeToIso(remindOn));
      this.dialogRef.close(true);
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
