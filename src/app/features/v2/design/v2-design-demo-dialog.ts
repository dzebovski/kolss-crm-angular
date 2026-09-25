import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2LeadProduct } from '@domain/v2/lead-card.types';
import { V2ProductChips } from '../leads/card/v2-product-chips';
import { V2DialogShell } from '../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../ui/dialog/v2-form-field';
import { V2_CHANNEL_LABEL } from '../ui/v2-lead-labels';

// Popup preview for the design system page: the real popup frame, fields and chips with the
// Add comment copy. Nothing is saved; Save only closes it.
@Component({
  selector: 'app-v2-design-demo-dialog',
  imports: [TranslatePipe, V2DialogShell, V2FormField, V2ProductChips],
  template: `
    <app-v2-dialog
      [title]="'v2.comment.title' | translate"
      [subtitle]="'v2.design.demo.subtitle' | translate"
      [hint]="'v2.comment.hintNote' | translate"
      [saveLabel]="'v2.comment.save' | translate"
      (save)="close()"
    >
      <app-v2-form-field [label]="'v2.timeline.comment' | translate" [required]="true">
        <textarea
          rows="3"
          required
          cdkFocusInitial
          [placeholder]="'v2.popup.commentPlaceholder' | translate"
        ></textarea>
      </app-v2-form-field>
      <app-v2-form-field [label]="'v2.editContact.channel' | translate">
        <select>
          @for (channel of channels; track channel[0]) {
            <option [value]="channel[0]">{{ channel[1] | translate }}</option>
          }
        </select>
      </app-v2-form-field>
      <app-v2-form-field [label]="'v2.comment.remindOn' | translate">
        <input type="datetime-local" />
      </app-v2-form-field>
      <app-v2-product-chips [(selected)]="products" />
    </app-v2-dialog>
  `,
})
export class V2DesignDemoDialog {
  private readonly dialogRef = inject(DialogRef);

  protected readonly channels = Object.entries(V2_CHANNEL_LABEL).filter(([id]) => id !== 'other');
  protected readonly products = signal<readonly V2LeadProduct[]>(['kitchen']);

  protected close(): void {
    this.dialogRef.close();
  }
}
