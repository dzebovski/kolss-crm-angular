import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  v2EstimateFormChange,
  v2EstimateFormError,
  v2EstimateFormInitial,
} from '@domain/v2/project-estimate-form';
import type { V2Project } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2ProjectEstimateFields } from './v2-project-estimate-fields';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectEstimateData {
  readonly project: V2Project;
}

// Edit estimate (pipeline 4): the preliminary estimate as one total (amount + currency). An
// emptied amount clears it. Closes with the updated project, or null when nothing changed.
@Component({
  selector: 'app-v2-project-estimate-dialog',
  imports: [TranslatePipe, V2DialogShell, V2ProjectEstimateFields, V2ProjectNotice],
  template: `
    <app-v2-dialog
      [title]="'v2.projectCard.estimateEdit' | translate"
      [subtitle]="subtitle"
      width="form"
      [hint]="'v2.projectPopup.timelineHint' | translate"
      [cancelLabel]="'v2.projectPopup.cancel' | translate"
      [saveLabel]="'v2.projectPopup.saveChanges' | translate"
      [saveDisabled]="saving()"
      [invalid]="!!fieldError()"
      [errorCount]="fieldError() ? 1 : 0"
      [hasUnsavedInput]="!!change()"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <app-v2-project-notice tone="danger">{{ message }}</app-v2-project-notice>
      }
      <app-v2-project-estimate-fields [fields]="fields" [error]="touched() ? fieldError() : null" />
    </app-v2-dialog>
  `,
})
export class V2ProjectEstimateDialog {
  private readonly dialogRef = inject<DialogRef<V2Project | null>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2ProjectEstimateData>(DIALOG_DATA);

  private readonly project = this.data.project;
  protected readonly subtitle = `${this.project.code} · ${this.project.clientName}`;
  private readonly initial = v2EstimateFormInitial(
    this.project.estimate,
    this.project.paidTotals[0]?.currency ?? 'PLN',
    this.i18n.locale(),
  );

  protected readonly model = signal({ ...this.initial });
  protected readonly fields = form(this.model);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);

  protected readonly fieldError = computed(() => v2EstimateFormError(this.model()));
  protected readonly change = computed(() =>
    v2EstimateFormChange(this.model(), this.initial, this.project.estimate),
  );

  protected async save(): Promise<void> {
    if (this.saving() || this.fieldError()) return;
    const change = this.change();
    if (!change) {
      this.dialogRef.close(null);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      this.dialogRef.close(await this.projects.updateEstimate(this.project.id, change));
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
