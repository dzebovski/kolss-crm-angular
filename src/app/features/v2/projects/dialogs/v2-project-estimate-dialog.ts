import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  v2EstimateErrorCount,
  v2EstimateFormChanges,
  v2EstimateFormErrors,
  v2EstimateFormInitial,
} from '@domain/v2/project-estimate-form';
import { v2DefaultCurrency } from '@domain/v2/project-forms';
import type { V2Project } from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2ProjectEstimateFields } from './v2-project-estimate-fields';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectEstimateData {
  readonly project: V2Project;
}

// Edit estimate (Project card, pipeline 2.1/3): Kitchen, Appliances, Installation, Countertop,
// each an optional amount + currency + note. An emptied amount removes the line; only changed
// lines are sent. Read-only once the main contract exists (the page never opens it then).
// Closes with the updated project, or null when nothing changed.
@Component({
  selector: 'app-v2-project-estimate-dialog',
  imports: [TranslatePipe, V2DialogShell, V2ProjectEstimateFields, V2ProjectNotice],
  template: `
    <app-v2-dialog
      [title]="'v2.projectCard.estimate.edit' | translate"
      [subtitle]="subtitle"
      width="form"
      [hint]="'v2.projectPopup.timelineHint' | translate"
      [cancelLabel]="'v2.projectPopup.cancel' | translate"
      [saveLabel]="'v2.projectPopup.saveChanges' | translate"
      [saveDisabled]="saving()"
      [invalid]="errorCount() > 0"
      [errorCount]="errorCount()"
      [hasUnsavedInput]="hasUnsavedInput()"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <app-v2-project-notice tone="danger">{{ message }}</app-v2-project-notice>
      }
      <app-v2-project-estimate-fields [fields]="fields" [errors]="touched() ? errors() : {}" />
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
    v2DefaultCurrency(this.project.introDefault),
    this.i18n.locale(),
  );

  protected readonly model = signal(structuredClone(this.initial));
  protected readonly fields = form(this.model);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);

  protected readonly errors = computed(() => v2EstimateFormErrors(this.model()));
  protected readonly errorCount = computed(() => v2EstimateErrorCount(this.errors()));
  private readonly changes = computed(() =>
    v2EstimateFormChanges(this.model(), this.initial, this.project.estimate),
  );
  protected readonly hasUnsavedInput = computed(() => Object.keys(this.changes()).length > 0);

  protected async save(): Promise<void> {
    if (this.saving() || this.errorCount() > 0) return;
    const lines = this.changes();
    if (!Object.keys(lines).length) {
      this.dialogRef.close(null);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      this.dialogRef.close(await this.projects.updateEstimate(this.project.id, { lines }));
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
