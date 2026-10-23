import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2DialogShell } from '../ui/dialog/v2-dialog-shell';

// Confirm step of Delete task (Q-T3 default): a status popup with the red primary button. The
// panel does the soft delete (`status: canceled`) when this closes with `true`.
@Component({
  selector: 'app-v2-task-delete-dialog',
  imports: [TranslatePipe, V2DialogShell],
  template: `
    <app-v2-dialog
      [title]="'v2.tasks.delete.title' | translate"
      width="status"
      [cancelLabel]="'v2.tasks.delete.cancel' | translate"
      [saveLabel]="'v2.tasks.delete.confirm' | translate"
      primaryVariant="danger"
      (save)="dialogRef.close(true)"
    >
      <p class="v2-task-delete__text">{{ 'v2.tasks.delete.text' | translate }}</p>
    </app-v2-dialog>
  `,
  styles: `
    .v2-task-delete__text {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
  `,
})
export class V2TaskDeleteDialog {
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
}
