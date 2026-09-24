import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';

export interface V2EditEntryData {
  readonly comment: string;
}

// Edit a timeline entry's text (decision D6, as v1 "Edit history"). Not drawn: the v2 popup
// frame with one Comment field and the v1 copy. Closes with the new text.
@Component({
  selector: 'app-v2-edit-entry-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      [title]="'lead.editHistory' | translate"
      [subtitle]="'lead.editHistoryHint' | translate"
      [hint]="'v2.dialog.autoAuthor' | translate"
      [saveLabel]="'common.save' | translate"
      [saveDisabled]="!entry().valid() || !model().comment.trim()"
      (save)="save()"
    >
      <app-v2-form-field [label]="'v2.timeline.comment' | translate" [required]="true">
        <textarea cdkFocusInitial rows="4" [formField]="entry.comment"></textarea>
      </app-v2-form-field>
    </app-v2-dialog>
  `,
})
export class V2EditEntryDialog {
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);
  private readonly data = inject<V2EditEntryData>(DIALOG_DATA);

  protected readonly model = signal({ comment: this.data.comment });
  protected readonly entry = form(this.model, (path) => {
    required(path.comment);
  });

  protected save(): void {
    const comment = this.model().comment.trim();
    if (comment) this.dialogRef.close(comment);
  }
}

export interface V2DeleteEntryData {
  /** v1 warns that office-work entries also remove the linked calendar work. */
  readonly officeWork: boolean;
}

// Delete a timeline entry (decision D6). Not drawn: the v2 popup frame with the v1 confirm copy.
// Closes with `true` to delete.
@Component({
  selector: 'app-v2-delete-entry-dialog',
  imports: [TranslatePipe, V2DialogShell],
  template: `
    <app-v2-dialog
      [title]="'leadDetail.deleteEventTitle' | translate"
      [saveLabel]="'leadDetail.deleteEventConfirmButton' | translate"
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
