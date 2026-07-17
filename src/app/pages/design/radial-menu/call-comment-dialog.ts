import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { UiButton } from '../../../ui/button/ui-button';
import { UiTextarea } from '../../../ui/form/ui-textarea';
import { UiIcon } from '../../../ui/icon/ui-icon';
import { CallAction } from './radial-menu.types';

export interface CallCommentDialogData {
  readonly action: CallAction;
}

@Component({
  selector: 'app-call-comment-dialog',
  imports: [FormField, UiButton, UiIcon, UiTextarea],
  template: `
    <form class="comment-dialog" (submit)="save(); $event.preventDefault()">
      <div class="comment-dialog__result">
        <span aria-hidden="true">
          <app-ui-icon [name]="data.action.icon" [size]="25" [filled]="true" />
        </span>
        <div>
          <small>Обрано</small>
          <strong>Дзвінок успішний</strong>
        </div>
      </div>

      <div class="comment-dialog__heading">
        <span class="comment-dialog__kicker">Короткий підсумок</span>
        <h2 id="call-comment-title">Що важливо запамʼятати?</h2>
        <p>Коментар існує лише в цьому proof of concept і не потрапляє до бази.</p>
      </div>

      <app-ui-textarea
        label="Коментар"
        placeholder="Наприклад: погодили наступний крок і дату зустрічі"
        hint="Обовʼязкове поле"
        [rows]="4"
        [formField]="commentForm.comment"
        [error]="commentError()"
      />

      <div class="comment-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="cancel()">Скасувати</app-ui-button>
        <app-ui-button type="submit" [disabled]="commentForm().invalid()">
          Зберегти коментар
        </app-ui-button>
      </div>
    </form>
  `,
  styleUrl: './call-comment-dialog.scss',
})
export class CallCommentDialog {
  protected readonly data = inject<CallCommentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CallCommentDialog, string>);

  protected readonly commentModel = signal({ comment: '' });
  protected readonly commentForm = form(this.commentModel, (schema) => {
    required(schema.comment, { message: 'Додайте коментар.' });
    validate(schema.comment, ({ value }) =>
      value().trim() ? undefined : { kind: 'whitespace', message: 'Додайте коментар.' },
    );
  });

  protected commentError(): string {
    const state = this.commentForm.comment();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected save(): void {
    submit(this.commentForm, async () => {
      this.dialogRef.close(this.commentModel().comment.trim());
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
