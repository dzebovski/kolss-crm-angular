import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, input, output } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2Button } from '../v2-button';
import { V2_DIALOG_TITLE_ID } from './v2-dialog.service';

// Popup frame from lead card v1.3 (Modal) and the design system README (Popups): header with
// title + one-line subtitle and a close button, scrolling body, footer with a hint on the
// left and Cancel + primary on the right. The fields are projected. Save submits the form
// (Enter in a field too) and emits `save`; the popup component saves and closes itself.
@Component({
  selector: 'app-v2-dialog',
  imports: [TranslatePipe, V2Button],
  templateUrl: './v2-dialog-shell.html',
  styleUrl: './v2-dialog-shell.scss',
})
export class V2DialogShell {
  private readonly dialogRef = inject(DialogRef);
  protected readonly titleId = inject(V2_DIALOG_TITLE_ID, { optional: true });

  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly hint = input('');
  readonly saveLabel = input.required<string>();
  readonly saveDisabled = input(false);
  readonly save = output<void>();

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.saveDisabled()) return;
    this.save.emit();
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
