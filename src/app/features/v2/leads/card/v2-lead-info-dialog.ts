import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, validate } from '@angular/forms/signals';

import type { UpdateLeadInfoRequest } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import type { Lead } from '@domain/lead.types';
import { isV2BudgetText, v2IsoToLocalDateTime, v2LocalDateTimeToIso } from '@domain/v2/lead-action';
import type { V2LeadColumns, V2LeadProduct } from '@domain/v2/lead-card.types';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2ProductChips } from './v2-product-chips';

export interface V2LeadInfoData {
  readonly lead: Lead;
  readonly columns: V2LeadColumns;
}

interface LeadInfoModel {
  budget: string;
  location: string;
  fronts: string;
  worktop: string;
  appliances: string;
  leadTime: string;
  measurement: string;
}

// Lead info popup from lead card v1.3 (Modal `info`): Estimated budget, Location, Product (one
// or more), Material preferences (fronts / worktop / appliances), Expected lead time, Preferred
// measurement date. Saves only what changed through `PATCH /v1/leads/{id}/info` (W7); the API
// logs it in the timeline. Closes with `true` after a save.
@Component({
  selector: 'app-v2-lead-info-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField, V2ProductChips],
  template: `
    <app-v2-dialog
      [title]="'v2.leadInfo.title' | translate"
      [subtitle]="'v2.leadInfo.subtitle' | translate"
      [hint]="'v2.leadInfo.hint' | translate"
      [saveLabel]="'v2.leadInfo.save' | translate"
      [saveDisabled]="!info().valid() || saving()"
      (save)="save()"
    >
      @if (error(); as message) {
        <p class="v2-lead-info__error" role="alert">{{ message }}</p>
      }

      <div class="v2-lead-info__pair">
        <app-v2-form-field [label]="'v2.card.budget' | translate">
          <input
            cdkFocusInitial
            autocomplete="off"
            [placeholder]="'v2.leadInfo.budgetPlaceholder' | translate"
            [formField]="info.budget"
          />
        </app-v2-form-field>
        <app-v2-form-field [label]="'v2.card.location' | translate">
          <input
            autocomplete="off"
            [placeholder]="'v2.leadInfo.locationPlaceholder' | translate"
            [formField]="info.location"
          />
        </app-v2-form-field>
      </div>

      <app-v2-product-chips [(selected)]="products" />

      <div class="v2-lead-info__group" role="group" [attr.aria-labelledby]="materialsId">
        <span class="v2-lead-info__label" [id]="materialsId">{{
          'v2.leadInfo.materials' | translate
        }}</span>
        <div class="v2-lead-info__materials">
          <app-v2-form-field>
            <input
              autocomplete="off"
              [attr.aria-label]="'v2.leadInfo.fronts' | translate"
              [placeholder]="'v2.leadInfo.fronts' | translate"
              [formField]="info.fronts"
            />
          </app-v2-form-field>
          <app-v2-form-field>
            <input
              autocomplete="off"
              [attr.aria-label]="'v2.leadInfo.worktop' | translate"
              [placeholder]="'v2.leadInfo.worktop' | translate"
              [formField]="info.worktop"
            />
          </app-v2-form-field>
          <app-v2-form-field>
            <input
              autocomplete="off"
              [attr.aria-label]="'v2.leadInfo.appliances' | translate"
              [placeholder]="'v2.leadInfo.appliances' | translate"
              [formField]="info.appliances"
            />
          </app-v2-form-field>
        </div>
      </div>

      <div class="v2-lead-info__pair">
        <app-v2-form-field [label]="'v2.leadInfo.leadTime' | translate">
          <input
            autocomplete="off"
            [placeholder]="'v2.leadInfo.leadTimePlaceholder' | translate"
            [formField]="info.leadTime"
          />
        </app-v2-form-field>
        <app-v2-form-field [label]="'v2.leadInfo.measurement' | translate">
          <input type="datetime-local" [formField]="info.measurement" />
        </app-v2-form-field>
      </div>
    </app-v2-dialog>
  `,
  styles: `
    :host {
      display: block;
    }

    .v2-lead-info__pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--v2-space-3);
    }

    .v2-lead-info__group {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-2);
    }

    .v2-lead-info__label {
      color: var(--v2-muted);
      font-size: 12px;
    }

    .v2-lead-info__materials {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--v2-space-2);
    }

    .v2-lead-info__error {
      margin: 0;
      padding: 10px var(--v2-space-3);
      background: var(--v2-danger-bg);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-danger);
      font-size: 13px;
      font-weight: 500;
    }

    @media (max-width: 480px) {
      .v2-lead-info__pair,
      .v2-lead-info__materials {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class V2LeadInfoDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2LeadInfoData>(DIALOG_DATA);

  protected readonly materialsId = 'v2-lead-info-materials';

  private readonly initial: LeadInfoModel = {
    budget: this.data.columns.estimatedBudgetText ?? budgetFromV1(this.data.lead),
    location: this.data.lead.cityRegion,
    fronts: this.data.columns.materialFronts ?? '',
    worktop: this.data.columns.materialWorktop ?? '',
    appliances: this.data.columns.materialAppliances ?? '',
    leadTime: this.data.columns.expectedLeadTime ?? '',
    measurement: v2IsoToLocalDateTime(this.data.columns.preferredMeasurementAt),
  };
  private readonly model = signal<LeadInfoModel>({ ...this.initial });
  protected readonly products = signal<readonly V2LeadProduct[]>(this.data.columns.products);
  protected readonly info = form(this.model, (path) => {
    validate(path.budget, ({ value }) =>
      isV2BudgetText(value())
        ? undefined
        : { kind: 'budget', message: this.i18n.t('v2.leadInfo.budgetInvalid') },
    );
  });

  protected readonly saving = signal(false);
  private readonly saveError = signal('');
  /** The budget format error as soon as the text is wrong, then any save error. */
  protected readonly error = computed(
    () => this.info.budget().errors()[0]?.message ?? this.saveError(),
  );

  protected async save(): Promise<void> {
    if (this.saving() || !this.info().valid()) return;
    const request = this.changes();
    if (!Object.keys(request).length) {
      this.dialogRef.close(false);
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.service.updateLeadInfo(this.data.lead, request);
      this.dialogRef.close(true);
    } catch (error) {
      this.saveError.set(
        error instanceof Error
          ? this.i18n.localizeError(error.message)
          : this.i18n.t('lead.saveChangesFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  /** Only the fields the viewer changed (the API keeps the rest). */
  private changes(): UpdateLeadInfoRequest {
    const value = this.model();
    const initial = this.initial;
    const changed = (key: keyof LeadInfoModel) => value[key].trim() !== initial[key].trim();
    const products = this.products();
    return {
      ...(changed('budget') ? { estimatedBudgetText: value.budget.trim() } : {}),
      ...(changed('location') ? { cityRegion: value.location.trim() } : {}),
      ...(sameProducts(products, this.data.columns.products) ? {} : { products: [...products] }),
      ...(changed('fronts') ? { materialFronts: value.fronts.trim() } : {}),
      ...(changed('worktop') ? { materialWorktop: value.worktop.trim() } : {}),
      ...(changed('appliances') ? { materialAppliances: value.appliances.trim() } : {}),
      ...(changed('leadTime') ? { expectedLeadTime: value.leadTime.trim() } : {}),
      ...(value.measurement !== initial.measurement
        ? { preferredMeasurementAt: v2LocalDateTimeToIso(value.measurement) }
        : {}),
    };
  }
}

/** A v1 lead has only the number: offer it as the starting text. */
function budgetFromV1(lead: Lead): string {
  return lead.estimatedBudget == null ? '' : String(lead.estimatedBudget);
}

function sameProducts(a: readonly V2LeadProduct[], b: readonly V2LeadProduct[]): boolean {
  return a.length === b.length && a.every((product) => b.includes(product));
}
