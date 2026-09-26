import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';

import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2LeadProduct } from '@domain/v2/lead-card.types';
import { V2ProductChips } from '../leads/card/v2-product-chips';
import type { V2DialogLeadContext } from '../ui/dialog/v2-dialog-shell';
import { V2DialogShell } from '../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../ui/dialog/v2-form-field';
import { V2_CHANNEL_LABEL } from '../ui/v2-lead-labels';

/** Sample Lost.dc.html header data: shows the kit's optional lead-context row. */
const DEMO_LEAD_CONTEXT: V2DialogLeadContext = {
  initials: 'MZ',
  name: 'Marta Zielińska',
  code: 'W0231',
  phone: '+48 601 334 812',
  status: 'later',
};

// Popup preview for the design system page: the real popup frame, header lead context, fields
// and chips with the Add comment copy. Also demonstrates the required-field / footer-error
// anatomy (Popup-rules.dc.html "Validation"): press Save empty to see it. Nothing is saved;
// Save only closes it once the comment is filled in.
@Component({
  selector: 'app-v2-design-demo-dialog',
  imports: [TranslatePipe, V2DialogShell, V2FormField, V2ProductChips],
  template: `
    <app-v2-dialog
      [title]="'v2.comment.title' | translate"
      [subtitle]="'v2.design.demo.subtitle' | translate"
      [leadContext]="leadContext"
      [hint]="'v2.comment.hintNote' | translate"
      [saveLabel]="'v2.comment.save' | translate"
      [invalid]="invalid()"
      [errorCount]="invalid() ? 1 : 0"
      [hasUnsavedInput]="text().trim() !== ''"
      (save)="close()"
      (invalidAttempt)="touched.set(true)"
    >
      <app-v2-form-field
        [label]="'v2.timeline.comment' | translate"
        [required]="true"
        [error]="touched() && invalid() ? ('v2.dialog.fieldRequired' | translate) : ''"
      >
        <textarea
          rows="3"
          cdkFocusInitial
          [placeholder]="'v2.popup.commentPlaceholder' | translate"
          [value]="text()"
          (input)="onCommentInput($event)"
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

  protected readonly leadContext = DEMO_LEAD_CONTEXT;
  protected readonly channels = Object.entries(V2_CHANNEL_LABEL).filter(([id]) => id !== 'other');
  protected readonly products = signal<readonly V2LeadProduct[]>(['kitchen']);
  protected readonly text = signal('');
  protected readonly touched = signal(false);
  protected readonly invalid = computed(() => !this.text().trim());

  protected onCommentInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected close(): void {
    if (this.invalid()) return;
    this.dialogRef.close();
  }
}
