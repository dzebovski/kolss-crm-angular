import { Component, inject, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { V2EstimateError, V2EstimateForm } from '@domain/v2/project-estimate-form';
import { V2_PROJECT_CURRENCIES } from '@domain/v2/project-money';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2Select } from '../../ui/v2-select';

// The preliminary estimate total (amount + currency, optional). Used by Edit estimate and Create
// project; the parent owns the form, validation (`v2EstimateFormError`) and saving.
@Component({
  selector: 'app-v2-project-estimate-fields',
  imports: [FormField, TranslatePipe, V2FormField, V2Select],
  template: `
    <app-v2-form-field
      [label]="'v2.projectCard.estimateTotal' | translate"
      [hint]="'v2.projectPopup.estimate.hint' | translate"
      [error]="error() ? i18n.t('v2.projectPopup.amountMissing') : ''"
    >
      <input type="text" inputmode="decimal" [formField]="fields().amount" />
    </app-v2-form-field>
    <app-v2-form-field [label]="'v2.projectPopup.currency' | translate">
      <app-v2-select
        [ariaLabel]="'v2.projectPopup.currency' | translate"
        [options]="currencies"
        [formField]="fields().currency"
      />
    </app-v2-form-field>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--v2-space-3);
    }
  `,
})
export class V2ProjectEstimateFields {
  protected readonly i18n = inject(I18nService);

  readonly fields = input.required<FieldTree<V2EstimateForm>>();
  /** Shown error (the parent hides it until the first save attempt). */
  readonly error = input<V2EstimateError | null>(null);

  protected readonly currencies = V2_PROJECT_CURRENCIES.map((code) => ({
    value: code,
    label: code,
  }));
}
