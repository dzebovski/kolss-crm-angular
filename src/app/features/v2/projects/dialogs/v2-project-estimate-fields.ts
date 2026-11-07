import { Component, computed, inject, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import {
  v2EstimateFormTotals,
  V2_ESTIMATE_NOTE_MAX,
  type V2EstimateForm,
  type V2EstimateLineError,
  type V2EstimateLineErrors,
} from '@domain/v2/project-estimate-form';
import { formatV2Money, V2_ESTIMATE_LINES, V2_PROJECT_CURRENCIES } from '@domain/v2/project-money';
import type { V2EstimateLineKey } from '@domain/v2/project.types';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2Select } from '../../ui/v2-select';

const ERROR_KEY: Record<V2EstimateLineError, MessageKey> = {
  amountInvalid: 'v2.projectPopup.amountMissing',
  noteWithoutAmount: 'v2.projectPopup.estimate.noteWithoutAmount',
  noteTooLong: 'v2.projectCard.commentTooLong',
};

// The four estimate lines (Kitchen, Appliances, Installation, Countertop: amount + currency +
// note, all optional) with the live total per currency. Used by Edit estimate and Create project;
// the parent owns the form, validation (`v2EstimateFormErrors`) and saving.
@Component({
  selector: 'app-v2-project-estimate-fields',
  imports: [FormField, TranslatePipe, V2FormField, V2Select],
  template: `
    @for (line of lineKeys; track line) {
      @let field = fields()[line];
      <fieldset class="v2-estimate-fields__line">
        <legend>{{ labelKey(line) | translate }}</legend>
        <div class="v2-estimate-fields__money">
          <app-v2-form-field
            [label]="'v2.projectPopup.estimate.amount' | translate"
            [error]="error(line, 'amount')"
          >
            <input type="text" inputmode="decimal" [formField]="field.amount" />
          </app-v2-form-field>
          <app-v2-form-field [label]="'v2.projectPopup.currency' | translate">
            <app-v2-select
              [ariaLabel]="'v2.projectPopup.currency' | translate"
              [options]="currencies"
              [formField]="field.currency"
            />
          </app-v2-form-field>
        </div>
        <app-v2-form-field
          [label]="'v2.projectCard.row.note' | translate"
          [error]="error(line, 'note')"
        >
          <input type="text" [formField]="field.note" />
        </app-v2-form-field>
      </fieldset>
    }
    <p class="v2-estimate-fields__total">
      <span>{{ 'v2.projectCard.estimate.total' | translate }}</span>
      <strong>{{ total() || '—' }}</strong>
    </p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-4);
    }

    .v2-estimate-fields__line {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-3);
      min-width: 0;
      margin: 0;
      padding: 0 0 var(--v2-space-4);
      border: 0;
      border-bottom: 1px solid var(--v2-line-soft);

      legend {
        padding: 0;
        margin-bottom: var(--v2-space-3);
        font-size: 14px;
        font-weight: 600;
      }
    }

    .v2-estimate-fields__money {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--v2-space-3);
    }

    .v2-estimate-fields__total {
      display: flex;
      justify-content: space-between;
      gap: var(--v2-space-4);
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
  `,
})
export class V2ProjectEstimateFields {
  private readonly i18n = inject(I18nService);

  readonly fields = input.required<FieldTree<V2EstimateForm>>();
  /** Shown errors (the parent hides them until the first save attempt). */
  readonly errors = input<Partial<Record<V2EstimateLineKey, V2EstimateLineErrors>>>({});

  protected readonly lineKeys = V2_ESTIMATE_LINES;
  protected readonly currencies = V2_PROJECT_CURRENCIES.map((code) => ({
    value: code,
    label: code,
  }));

  protected readonly total = computed(() => {
    const locale = this.i18n.locale();
    return v2EstimateFormTotals(this.fields()().value())
      .map((money) => formatV2Money(money, locale))
      .join(' + ');
  });

  protected labelKey(key: V2EstimateLineKey): MessageKey {
    return `v2.project.estimate.${key}` as MessageKey;
  }

  protected error(key: V2EstimateLineKey, part: 'amount' | 'note'): string {
    const code = this.errors()[key]?.[part];
    return code ? this.i18n.t(ERROR_KEY[code], { max: V2_ESTIMATE_NOTE_MAX }) : '';
  }
}
