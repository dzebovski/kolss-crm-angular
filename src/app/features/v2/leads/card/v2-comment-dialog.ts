import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { isSuperAdminRole } from '@core/roles/roles';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { Lead } from '@domain/lead.types';
import { v2LocalDateTimeToIso } from '@domain/v2/lead-action';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import type { V2LeadColumns } from '@domain/v2/lead-card.types';
import type { CrmEmployee } from '@services/users.service';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { v2LiveNow } from '../../core/v2-clock';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2DateTimeInput } from '../../ui/v2-date-time-input';

export interface V2CommentData {
  readonly leadId: string;
  readonly lead: Lead;
  readonly columns: V2LeadColumns;
  readonly employees: readonly CrmEmployee[];
  readonly now: Date;
}

interface CommentModel {
  text: string;
  remindOn: string;
  assignedTo: string;
}

// Add-comment.dc.html: a comment is required; the optional date creates a personal reminder,
// while a selected teammate turns it into that teammate's task. Closes with `true` after a save.
@Component({
  selector: 'app-v2-comment-dialog',
  imports: [FormField, TranslatePipe, V2DateTimeInput, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      [title]="'v2.comment.title' | translate"
      [subtitle]="'v2.comment.subtitle' | translate"
      [leadContext]="leadContext()"
      width="form"
      [hint]="hint()"
      [cancelLabel]="'v2.comment.cancel' | translate"
      [saveLabel]="'v2.comment.save' | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="missingCount()"
      [hasUnsavedInput]="hasUnsavedInput()"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <p class="v2-comment__error" role="alert">{{ message }}</p>
      }
      <app-v2-form-field
        [label]="'v2.timeline.comment' | translate"
        [required]="true"
        [hint]="'v2.comment.commentHint' | translate"
        [error]="commentError()"
      >
        <textarea
          cdkFocusInitial
          rows="3"
          [placeholder]="'v2.comment.placeholder' | translate"
          [formField]="comment.text"
        ></textarea>
      </app-v2-form-field>
      <section
        class="v2-comment__reminder"
        [attr.aria-label]="'v2.comment.reminderTitle' | translate"
      >
        <h3>{{ 'v2.comment.reminderTitle' | translate }}</h3>
        <p>{{ 'v2.comment.reminderDescription' | translate }}</p>
        <app-v2-form-field
          [label]="'v2.comment.remindOn' | translate"
          [hint]="'v2.comment.remindOnHint' | translate"
          [error]="dateError()"
        >
          <app-v2-date-time-input [formField]="comment.remindOn" />
        </app-v2-form-field>
        <app-v2-form-field
          [label]="'v2.comment.assignTo' | translate"
          [hint]="'v2.comment.assignToHint' | translate"
        >
          <select [formField]="comment.assignedTo">
            <option value="">{{ 'v2.comment.onlyMe' | translate }}</option>
            @for (employee of assignees(); track employee.id) {
              <option [value]="employee.id">{{ employee.name }}</option>
            }
          </select>
        </app-v2-form-field>
      </section>
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

    .v2-comment__reminder {
      display: grid;
      gap: var(--v2-space-3);
      padding: var(--v2-space-4);
      border: 1px solid var(--v2-line-soft);
      border-radius: var(--v2-radius-sm);
      background: var(--v2-surface-sunk);
    }

    .v2-comment__reminder h3,
    .v2-comment__reminder p {
      margin: 0;
    }

    .v2-comment__reminder h3 {
      color: var(--v2-muted);
      font-size: 12px;
      letter-spacing: 0.08em;
    }

    .v2-comment__reminder p {
      color: var(--v2-muted);
      font-size: 13px;
      line-height: 1.45;
    }
  `,
})
export class V2CommentDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2CommentData>(DIALOG_DATA);

  protected readonly model = signal<CommentModel>({ text: '', remindOn: '', assignedTo: '' });
  protected readonly comment = form(this.model, (path) => {
    required(path.text);
  });
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  /** Set once Save is pressed while empty; the comment field only turns red after that. */
  protected readonly touched = signal(false);
  protected readonly leadContext = computed(() => toV2LeadCard(this.data.lead, this.data.columns));
  protected readonly assignees = computed(() =>
    this.data.employees
      .filter(
        (employee) =>
          employee.status === 'active' &&
          !isSuperAdminRole(employee.role) &&
          employee.officeIds.includes(this.data.lead.officeCode),
      )
      .map((employee) => ({ id: employee.id, name: employee.displayName })),
  );
  private readonly liveNow = v2LiveNow();
  private readonly dueAt = computed(() => v2LocalDateTimeToIso(this.model().remindOn));
  private readonly hasFutureDueAt = computed(() => {
    const dueAt = this.dueAt();
    return dueAt !== null && new Date(dueAt).getTime() > this.liveNow().getTime();
  });
  protected readonly missingCount = computed(() => {
    const value = this.model();
    let count = value.text.trim() ? 0 : 1;
    if ((value.remindOn || value.assignedTo) && !this.hasFutureDueAt()) count++;
    return count;
  });
  protected readonly invalid = computed(() => this.missingCount() > 0);
  protected readonly hasUnsavedInput = computed(() => {
    const value = this.model();
    return value.text.trim() !== '' || value.remindOn !== '' || value.assignedTo !== '';
  });
  protected readonly commentError = computed(() =>
    this.touched() && !this.model().text.trim() ? this.i18n.t('v2.dialog.fieldRequired') : '',
  );
  protected readonly dateError = computed(() => {
    if (!this.touched()) return '';
    if (this.model().assignedTo && !this.model().remindOn)
      return this.i18n.t('v2.dialog.fieldRequired');
    if (this.model().remindOn && !this.hasFutureDueAt())
      return this.i18n.t('v2.popup.dateMustBeFuture');
    return '';
  });
  /** The board keeps the footer outcome copy fixed for a note, reminder, or task. */
  protected readonly hint = computed(() => this.i18n.t('v2.comment.footerNote'));

  protected async save(): Promise<void> {
    const { text, assignedTo } = this.model();
    if (this.saving() || this.invalid()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.service.addComment(this.data.leadId, text, this.dueAt(), assignedTo || null);
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
