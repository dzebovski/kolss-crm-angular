import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';

import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';

export interface V2ProjectConfirmData {
  readonly title: string;
  readonly text: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

// Confirm step of Delete contract / Delete payment: a status popup with the red primary button,
// as Delete task. The caller deletes when this closes with `true`.
@Component({
  selector: 'app-v2-project-confirm-dialog',
  imports: [V2DialogShell],
  template: `
    <app-v2-dialog
      [title]="data.title"
      width="status"
      [cancelLabel]="data.cancelLabel"
      [saveLabel]="data.confirmLabel"
      primaryVariant="danger"
      (save)="dialogRef.close(true)"
    >
      <p class="v2-project-confirm__text">{{ data.text }}</p>
    </app-v2-dialog>
  `,
  styles: `
    .v2-project-confirm__text {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
    }
  `,
})
export class V2ProjectConfirmDialog {
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<V2ProjectConfirmData>(DIALOG_DATA);
}
