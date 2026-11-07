import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import type { UpdateLeadInfoRequest } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG, OFFICE_IDS } from '@core/office/office.config';
import { isSuperAdminRole } from '@core/roles/roles';
import type { ContractCurrency, Lead } from '@domain/lead.types';
import { formatV2CardDate, formatV2Time } from '@domain/v2/date-format';
import {
  v2ChangedContactFields,
  v2CreateProjectContact,
  v2CreateProjectInfoChanges,
  v2CreateProjectInitial,
  v2SameProducts,
  type V2CreateProjectChecklistField,
  type V2CreateProjectForm,
} from '@domain/v2/create-project';
import { isV2BudgetText } from '@domain/v2/lead-action';
import {
  v2DocumentLocalErrorCount,
  v2UpdatePendingDocument,
  type V2PendingDocument,
} from '@domain/v2/lead-documents';
import { toV2LeadCard } from '@domain/v2/lead-card.mapper';
import type { V2LeadColumns, V2LeadProduct } from '@domain/v2/lead-card.types';
import type { V2LeadChannel } from '@domain/v2/lead-view.types';
import { v2ValidatePhone } from '@domain/v2/phone-mask';
import {
  v2EstimateErrorCount,
  v2EstimateFormChanges,
  v2EstimateFormErrors,
  v2EstimateFormInitial,
} from '@domain/v2/project-estimate-form';
import type { V2Project } from '@domain/v2/project.types';
import type { CrmEmployee } from '@services/users.service';
import {
  V2EditContactPartialWriteError,
  V2LeadCardService,
} from '@services/v2/v2-lead-card.service';
import { V2LeadDocumentsService } from '@services/v2/v2-lead-documents.service';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2BudgetInput } from '../../ui/v2-budget-input';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2PhoneInput } from '../../ui/v2-phone-input';
import { V2ProjectEstimateFields } from '../../projects/dialogs/v2-project-estimate-fields';
import { V2DocumentPicker } from './v2-document-picker';
import { V2ProductChips } from './v2-product-chips';
import {
  V2_PICKABLE_CHANNELS,
  v2EmailValid,
  v2PhoneValidationMessage,
} from '../../ui/v2-contact-validation';

export interface V2CreateProjectData {
  readonly lead: Lead;
  readonly columns: V2LeadColumns;
  readonly employees: readonly CrmEmployee[];
  readonly now: Date;
}

/**
 * Closes with the new project (`estimateSaved` false when the project exists but its estimate
 * could not be written), or with nothing when the person backed out or it failed.
 */
export type V2CreateProjectResult =
  { readonly project: V2Project; readonly estimateSaved: boolean } | undefined;

// Create project (board `Create-project`, pipeline 3): the Edit contact and Fill lead info fields
// in one popup, then the project with its preliminary estimate (four optional lines instead of
// the board's project types; every project starts in Estimate). The lead is saved first
// (contact, then info, so the optimistic version chains), then `POST /v1/leads/{id}/project`
// (moves the lead to status Project and links it), then the estimate lines. If a lead step
// fails, the lead is reloaded so a retry only sends what is still unsaved; the idempotency key
// stays the same for the project request.
@Component({
  selector: 'app-v2-create-project-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2BudgetInput,
    V2DocumentPicker,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2PhoneInput,
    V2ProductChips,
    V2ProjectEstimateFields,
  ],
  templateUrl: './v2-create-project-dialog.html',
  styleUrl: './v2-create-project-dialog.scss',
})
export class V2CreateProjectDialog {
  private readonly dialogRef = inject<DialogRef<V2CreateProjectResult>>(DialogRef);
  private readonly leadService = inject(V2LeadCardService);
  private readonly projects = inject(V2ProjectsService);
  private readonly documentsService = inject(V2LeadDocumentsService);
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<V2CreateProjectData>(DIALOG_DATA);

  /** The lead as last loaded; replaced after a partly failed save. */
  private readonly lead = signal<Lead>(this.data.lead);
  private readonly columns = signal<V2LeadColumns>(this.data.columns);
  private readonly card = computed(() => toV2LeadCard(this.lead(), this.columns()));
  /** One key per distinct request body, so a retry of the same body is not created twice. */
  private idempotency = { body: '', key: '' };

  protected readonly leadContext = this.card;
  protected readonly officeConfig = OFFICE_CONFIG;
  protected readonly showrooms = OFFICE_IDS;
  protected readonly officeCode = this.data.lead.officeCode;
  protected readonly showroomLabelKey = OFFICE_CONFIG[this.officeCode].showroomCardLabelKey;
  protected readonly phoneCountryCode = OFFICE_CONFIG[this.officeCode].phoneCountryCode;
  protected readonly phonePlaceholder = OFFICE_CONFIG[this.officeCode].phonePlaceholder;
  protected readonly channelLabels = V2_CHANNEL_LABEL;
  protected readonly channels: readonly V2LeadChannel[] =
    this.card().channel === 'other' ? [...V2_PICKABLE_CHANNELS, 'other'] : V2_PICKABLE_CHANNELS;

  protected readonly managers = computed(() =>
    this.data.employees
      .filter(
        (employee) =>
          employee.status === 'active' &&
          !isSuperAdminRole(employee.role) &&
          employee.officeIds.includes(this.officeCode),
      )
      .map((employee) => ({ id: employee.id, name: employee.displayName })),
  );

  /** What the lead holds now; the popup only sends the difference. */
  private readonly initial = computed<V2CreateProjectForm>(() =>
    v2CreateProjectInitial(
      this.lead(),
      this.card(),
      this.columns(),
      this.managers().map((manager) => manager.id),
    ),
  );
  protected readonly model = signal<V2CreateProjectForm>({ ...this.initial() });
  protected readonly fields = form(this.model);
  protected readonly products = signal<readonly V2LeadProduct[]>(this.data.columns.products);
  protected readonly documents = signal<readonly V2PendingDocument[]>([]);
  private readonly estimateInitial = v2EstimateFormInitial(
    null,
    OFFICE_CONFIG[this.data.lead.officeCode].currency,
    this.i18n.locale(),
  );
  protected readonly estimate = signal(structuredClone(this.estimateInitial));
  protected readonly estimateFields = form(this.estimate);
  private readonly estimateErrors = computed(() => v2EstimateFormErrors(this.estimate()));
  protected readonly shownEstimateErrors = computed(() =>
    this.attempted() ? this.estimateErrors() : {},
  );
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly attempted = signal(false);
  protected readonly phoneBlurred = signal(false);
  protected readonly emailBlurred = signal(false);
  protected readonly budgetBlurred = signal(false);

  protected readonly createdText = computed(() => {
    const at = this.card().createdAt;
    const locale = this.i18n.locale();
    return `${formatV2CardDate(at, this.data.now, locale)}, ${formatV2Time(at)}`;
  });

  protected readonly checklist: readonly {
    readonly field: Exclude<V2CreateProjectChecklistField, 'clientInformed'>;
    readonly label: MessageKey;
  }[] = [
    { field: 'checklistBudget', label: 'v2.popup.success.checklistBudget' },
    { field: 'checklistLocation', label: 'v2.popup.success.checklistLocation' },
    { field: 'checklistPeriod', label: 'v2.popup.success.checklistPeriod' },
    { field: 'checklistMaterials', label: 'v2.popup.success.checklistMaterials' },
    { field: 'checklistProduct', label: 'v2.popup.success.checklistProduct' },
  ];
  private readonly phoneValidation = computed(() => v2ValidatePhone(this.model().phone));
  protected readonly checklistDoneCount = computed(
    () => this.checklist.filter((item) => this.model()[item.field]).length,
  );
  protected readonly nameError = computed(() =>
    this.attempted() && !this.model().name.trim() ? this.i18n.t('v2.editContact.nameRequired') : '',
  );
  protected readonly phoneError = computed(() => {
    if (!this.attempted() && !this.phoneBlurred()) return '';
    return v2PhoneValidationMessage(this.phoneValidation(), this.i18n);
  });
  protected readonly emailError = computed(() =>
    (this.attempted() || this.emailBlurred()) && !this.emailValid()
      ? this.i18n.t('v2.editContact.emailInvalid')
      : '',
  );
  protected readonly referredByError = computed(() =>
    this.attempted() && this.model().channel === 'referral' && !this.model().referredBy.trim()
      ? this.i18n.t('v2.editContact.referrerRequired')
      : '',
  );
  protected readonly budgetError = computed(() =>
    (this.attempted() || this.budgetBlurred()) && !this.budgetValid()
      ? this.i18n.t('v2.leadInfo.budgetInvalid')
      : '',
  );
  protected readonly informedError = computed(() =>
    this.attempted() && !this.model().clientInformed
      ? this.i18n.t('v2.leadInfo.clientInformedRequired')
      : '',
  );
  protected readonly managerError = computed(() =>
    this.attempted() && !this.model().responsibleManagerId
      ? this.i18n.t('v2.leadInfo.managerRequired')
      : '',
  );
  protected readonly missingCount = computed(() => {
    const value = this.model();
    let count = 0;
    if (!value.name.trim()) count++;
    if (this.phoneValidation().kind !== 'ok') count++;
    if (!this.emailValid()) count++;
    if (value.channel === 'referral' && !value.referredBy.trim()) count++;
    if (!this.budgetValid()) count++;
    if (!value.clientInformed) count++;
    if (!value.responsibleManagerId) count++;
    count += v2DocumentLocalErrorCount(this.documents());
    count += v2EstimateErrorCount(this.estimateErrors());
    return count;
  });
  protected readonly invalid = computed(() => this.missingCount() > 0);
  protected readonly hasUnsavedInput = computed(
    () =>
      JSON.stringify(this.model()) !== JSON.stringify(this.initial()) ||
      !v2SameProducts(this.products(), this.columns().products) ||
      this.documents().length > 0 ||
      JSON.stringify(this.estimate()) !== JSON.stringify(this.estimateInitial),
  );

  protected selectChannel(channel: V2LeadChannel): void {
    if (channel === 'other') return;
    this.model.update((value) => ({ ...value, channel }));
  }

  protected setPhone(phone: string): void {
    this.model.update((value) => ({ ...value, phone }));
  }

  protected setBudget(budget: string): void {
    this.model.update((value) => ({ ...value, budget }));
  }

  protected setCurrency(currency: ContractCurrency): void {
    this.model.update((value) => ({ ...value, currency }));
  }

  protected toggleChecklist(field: V2CreateProjectChecklistField): void {
    this.model.update((value) => ({ ...value, [field]: !value[field] }));
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.documentsService.uploadAll(this.lead().id, this.documents(), '', (id, change) =>
        this.documents.update((items) => v2UpdatePendingDocument(items, id, change)),
      );
      await this.saveLead();
      const body = { managerId: this.model().responsibleManagerId };
      const created = await this.projects.createFromLead(
        this.lead().id,
        body,
        this.idempotencyKeyFor(JSON.stringify(body)),
      );
      this.dialogRef.close({ project: created, estimateSaved: await this.saveEstimate(created) });
    } catch (error) {
      this.saveError.set(this.errorMessage(error));
      await this.reloadLead();
    } finally {
      this.saving.set(false);
    }
  }

  /** The project exists by now: a failed estimate must not undo it, the page says so instead. */
  private async saveEstimate(project: V2Project): Promise<boolean> {
    const lines = v2EstimateFormChanges(this.estimate(), this.estimateInitial, null);
    if (!Object.keys(lines).length) return true;
    try {
      await this.projects.updateEstimate(project.id, { lines });
      return true;
    } catch {
      return false;
    }
  }

  private idempotencyKeyFor(body: string): string {
    if (this.idempotency.body !== body) this.idempotency = { body, key: crypto.randomUUID() };
    return this.idempotency.key;
  }

  /** Contact first (its version feeds the info patch), then the info fields that changed. */
  private async saveLead(): Promise<void> {
    const managerId = this.lead().assignedToId;
    const contact = v2CreateProjectContact(this.model(), this.officeCode, managerId);
    const editedFields = v2ChangedContactFields(
      v2CreateProjectContact(this.initial(), this.officeCode, managerId),
      contact,
    );
    const info = this.infoChanges();
    if (!editedFields.length && !Object.keys(info).length) return;
    await this.leadService.editContactAndRequest(this.lead(), { contact, editedFields, info });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof V2EditContactPartialWriteError) {
      return this.i18n.t('v2.createProject.partialSave');
    }
    if (error instanceof KolssApiError) {
      if (error.code === 'project_exists') return this.i18n.t('v2.createProject.error.exists');
      if (error.code === 'lead_terminal') return this.i18n.t('v2.createProject.error.terminal');
      if (error.status === 403) return this.i18n.t('v2.createProject.error.forbidden');
    }
    return this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed');
  }

  /** After a failed save: what is already stored must not be sent again with a stale version. */
  private async reloadLead(): Promise<void> {
    try {
      const loaded = await this.leadService.load(this.lead().id);
      if (!loaded) return;
      this.lead.set(loaded.lead);
      this.columns.set(loaded.columns);
    } catch {
      // The error above is what the person needs; a retry reports a stale version if this failed.
    }
  }

  private emailValid(): boolean {
    return v2EmailValid(this.model().email);
  }

  private budgetValid(): boolean {
    return isV2BudgetText(this.model().budget);
  }

  private infoChanges(): UpdateLeadInfoRequest {
    return v2CreateProjectInfoChanges(
      this.model(),
      this.initial(),
      this.products(),
      this.columns().products,
    );
  }
}
