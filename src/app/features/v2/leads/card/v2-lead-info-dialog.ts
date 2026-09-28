import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import type { UpdateLeadInfoRequest } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import { isSuperAdminRole } from '@core/roles/roles';
import type { ContractCurrency, Lead } from '@domain/lead.types';
import { isV2BudgetText } from '@domain/v2/lead-action';
import {
  v2DocumentLocalErrorCount,
  v2UpdatePendingDocument,
  type V2PendingDocument,
} from '@domain/v2/lead-documents';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import type { V2LeadColumns, V2LeadProduct, V2ProjectType } from '@domain/v2/lead-card.types';
import type { CrmEmployee } from '@services/users.service';
import { V2LeadCardService } from '@services/v2/v2-lead-card.service';
import { V2LeadDocumentsService } from '@services/v2/v2-lead-documents.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2BudgetInput } from '../../ui/v2-budget-input';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2DocumentPicker } from './v2-document-picker';
import { V2ProductChips } from './v2-product-chips';

export interface V2LeadInfoData {
  readonly lead: Lead;
  readonly columns: V2LeadColumns;
  readonly employees: readonly CrmEmployee[];
}

interface LeadInfoModel {
  budget: string;
  currency: ContractCurrency;
  location: string;
  aboutClient: string;
  checklistBudget: boolean;
  checklistLocation: boolean;
  checklistPeriod: boolean;
  checklistMaterials: boolean;
  checklistProduct: boolean;
  clientInformed: boolean;
  projectType: V2ProjectType | '';
  responsibleManagerId: string;
}

type ChecklistField =
  | 'checklistBudget'
  | 'checklistLocation'
  | 'checklistPeriod'
  | 'checklistMaterials'
  | 'checklistProduct'
  | 'clientInformed';

@Component({
  selector: 'app-v2-lead-info-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2BudgetInput,
    V2DocumentPicker,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2ProductChips,
  ],
  templateUrl: './v2-lead-info-dialog.html',
  styleUrl: './v2-lead-info-dialog.scss',
})
export class V2LeadInfoDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly documentsService = inject(V2LeadDocumentsService);
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<V2LeadInfoData>(DIALOG_DATA);

  protected readonly leadContext = computed(() => toV2LeadCard(this.data.lead, this.data.columns));
  protected readonly channelLabels = V2_CHANNEL_LABEL;
  protected readonly showroomLabelKey =
    OFFICE_CONFIG[this.data.lead.officeCode].showroomCardLabelKey;

  private readonly initial: LeadInfoModel = {
    budget: this.data.columns.estimatedBudgetText ?? budgetFromV1(this.data.lead),
    currency: this.data.lead.estimatedBudgetCurrency,
    location: this.data.lead.cityRegion,
    aboutClient: this.data.columns.aboutClient ?? '',
    checklistBudget: this.data.columns.checklistBudget ?? false,
    checklistLocation: this.data.columns.checklistLocation ?? false,
    checklistPeriod: this.data.columns.checklistPeriod ?? false,
    checklistMaterials: this.data.columns.checklistMaterials ?? false,
    checklistProduct: this.data.columns.checklistProduct ?? false,
    clientInformed: this.data.columns.clientInformed ?? false,
    projectType: this.data.columns.projectType ?? '',
    responsibleManagerId: this.data.columns.responsibleManagerId ?? '',
  };
  protected readonly model = signal<LeadInfoModel>({ ...this.initial });
  protected readonly info = form(this.model);
  protected readonly products = signal<readonly V2LeadProduct[]>(this.data.columns.products);
  protected readonly documents = signal<readonly V2PendingDocument[]>([]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly touched = signal(false);

  protected readonly checklist: readonly {
    readonly field: Exclude<ChecklistField, 'clientInformed'>;
    readonly label: MessageKey;
  }[] = [
    { field: 'checklistBudget', label: 'v2.popup.success.checklistBudget' },
    { field: 'checklistLocation', label: 'v2.popup.success.checklistLocation' },
    { field: 'checklistPeriod', label: 'v2.popup.success.checklistPeriod' },
    { field: 'checklistMaterials', label: 'v2.popup.success.checklistMaterials' },
    { field: 'checklistProduct', label: 'v2.popup.success.checklistProduct' },
  ];
  protected readonly projectTypes: readonly {
    readonly value: V2ProjectType;
    readonly label: MessageKey;
    readonly description: MessageKey;
  }[] = [
    {
      value: 'express',
      label: 'v2.leadInfo.projectExpress',
      description: 'v2.leadInfo.projectExpressHint',
    },
    {
      value: 'measure',
      label: 'v2.leadInfo.projectMeasure',
      description: 'v2.leadInfo.projectMeasureHint',
    },
    {
      value: 'contract',
      label: 'v2.leadInfo.projectContract',
      description: 'v2.leadInfo.projectContractHint',
    },
  ];

  protected readonly managers = computed(() =>
    this.data.employees
      .filter(
        (employee) =>
          employee.status === 'active' &&
          !isSuperAdminRole(employee.role) &&
          employee.officeIds.includes(this.data.lead.officeCode),
      )
      .map((employee) => ({ id: employee.id, name: employee.displayName })),
  );
  protected readonly checklistDoneCount = computed(
    () => this.checklist.filter((item) => this.model()[item.field]).length,
  );
  protected readonly budgetValid = computed(() => isV2BudgetText(this.model().budget));
  protected readonly missingCount = computed(() => {
    let count = 0;
    if (!this.budgetValid()) count++;
    if (!this.model().clientInformed) count++;
    if (!this.model().responsibleManagerId) count++;
    count += v2DocumentLocalErrorCount(this.documents());
    return count;
  });
  protected readonly invalid = computed(() => this.missingCount() > 0);
  protected readonly hasUnsavedInput = computed(
    () =>
      JSON.stringify(this.model()) !== JSON.stringify(this.initial) ||
      !sameProducts(this.products(), this.data.columns.products) ||
      this.documents().length > 0,
  );
  protected readonly budgetError = computed(() =>
    this.touched() && !this.budgetValid() ? this.i18n.t('v2.leadInfo.budgetInvalid') : '',
  );
  protected readonly informedError = computed(() =>
    this.touched() && !this.model().clientInformed
      ? this.i18n.t('v2.leadInfo.clientInformedRequired')
      : '',
  );
  protected readonly managerError = computed(() =>
    this.touched() && !this.model().responsibleManagerId
      ? this.i18n.t('v2.leadInfo.managerRequired')
      : '',
  );

  protected setBudget(budget: string): void {
    this.model.update((value) => ({ ...value, budget }));
  }

  protected setCurrency(currency: ContractCurrency): void {
    this.model.update((value) => ({ ...value, currency }));
  }

  protected toggleChecklist(field: ChecklistField): void {
    this.model.update((value) => ({ ...value, [field]: !value[field] }));
  }

  protected toggleProjectType(projectType: V2ProjectType): void {
    this.model.update((value) => ({
      ...value,
      projectType: value.projectType === projectType ? '' : projectType,
    }));
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const request = this.changes();
    if (!Object.keys(request).length && this.documents().length === 0) {
      this.dialogRef.close(false);
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.documentsService.uploadAll(this.data.lead.id, this.documents(), '', (id, change) =>
        this.documents.update((items) => v2UpdatePendingDocument(items, id, change)),
      );
      if (Object.keys(request).length) await this.service.updateLeadInfo(this.data.lead, request);
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

  private changes(): UpdateLeadInfoRequest {
    const value = this.model();
    const initial = this.initial;
    const products = this.products();
    return {
      ...(value.budget.trim() !== initial.budget.trim()
        ? { estimatedBudgetText: value.budget.trim() }
        : {}),
      ...(value.currency !== initial.currency ? { estimatedBudgetCurrency: value.currency } : {}),
      ...(value.location.trim() !== initial.location.trim()
        ? { cityRegion: value.location.trim() }
        : {}),
      ...(sameProducts(products, this.data.columns.products) ? {} : { products: [...products] }),
      ...(value.aboutClient.trim() !== initial.aboutClient.trim()
        ? { aboutClient: value.aboutClient.trim() }
        : {}),
      ...changedBoolean(value, initial, 'checklistBudget'),
      ...changedBoolean(value, initial, 'checklistLocation'),
      ...changedBoolean(value, initial, 'checklistPeriod'),
      ...changedBoolean(value, initial, 'checklistMaterials'),
      ...changedBoolean(value, initial, 'checklistProduct'),
      ...changedBoolean(value, initial, 'clientInformed'),
      ...(value.projectType !== initial.projectType ? { projectType: value.projectType } : {}),
      ...(value.responsibleManagerId !== initial.responsibleManagerId
        ? { responsibleManagerId: value.responsibleManagerId }
        : {}),
    };
  }
}

function changedBoolean(
  value: LeadInfoModel,
  initial: LeadInfoModel,
  key: ChecklistField,
): Partial<Pick<UpdateLeadInfoRequest, ChecklistField>> {
  return value[key] === initial[key] ? {} : { [key]: value[key] };
}

function budgetFromV1(lead: Lead): string {
  return lead.estimatedBudget == null ? '' : String(lead.estimatedBudget);
}

function sameProducts(a: readonly V2LeadProduct[], b: readonly V2LeadProduct[]): boolean {
  return a.length === b.length && a.every((product) => b.includes(product));
}
