import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import type { CreateLeadRequest } from '@core/api/generated/kolss-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import type { ContractCurrency } from '@domain/lead.types';
import type { OfficeId } from '@domain/office.types';
import {
  v2CreateLeadLegacySource,
  v2CreateLeadLocalDateTime,
  type V2CreateLeadChannel,
} from '@domain/v2/create-lead';
import { isV2BudgetText } from '@domain/v2/lead-action';
import {
  v2DocumentLocalErrorCount,
  v2UpdatePendingDocument,
  type V2PendingDocument,
} from '@domain/v2/lead-documents';
import type { V2LeadProduct } from '@domain/v2/lead-card.types';
import { v2ValidatePhone, type V2PhoneValidation } from '@domain/v2/phone-mask';
import { v2StoredPhone } from '@domain/v2/phone-storage';
import type { Office } from '@models/database';
import { V2LeadsListService } from '@services/v2/v2-leads-list.service';
import { V2LeadDocumentsService } from '@services/v2/v2-lead-documents.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2BudgetInput } from '../../ui/v2-budget-input';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2PhoneInput } from '../../ui/v2-phone-input';
import { V2ProductChips } from '../card/v2-product-chips';
import { V2DocumentPicker } from '../card/v2-document-picker';

export interface V2CreateLeadData {
  readonly offices: readonly Office[];
  readonly defaultOffice: OfficeId | '';
  readonly now: Date;
  /** Called as soon as the lead exists, so the page can open it even if a later upload fails. */
  readonly onCreated: (leadId: string) => void;
}

interface CreateLeadModel {
  name: string;
  phone: string;
  email: string;
  showroom: OfficeId | '';
  channel: V2CreateLeadChannel;
  referredBy: string;
  createdDate: string;
  createdTime: string;
  budget: string;
  currency: ContractCurrency;
  location: string;
  request: string;
}

const CHANNELS: readonly V2CreateLeadChannel[] = [
  'office',
  'phone',
  'website',
  'meta_ads',
  'google_ads',
  'referral',
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

@Component({
  selector: 'app-v2-create-lead-dialog',
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
  ],
  templateUrl: './v2-create-lead-dialog.html',
  styleUrl: './v2-create-lead-dialog.scss',
})
export class V2CreateLeadDialog {
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);
  private readonly service = inject(V2LeadsListService);
  private readonly documentsService = inject(V2LeadDocumentsService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2CreateLeadData>(DIALOG_DATA);

  protected readonly channels = CHANNELS;
  protected readonly channelLabels = V2_CHANNEL_LABEL;
  protected readonly officeConfig = OFFICE_CONFIG;
  protected readonly showroomOptions = this.data.offices
    .filter((office) => office.code === 'kyiv' || office.code === 'warsaw')
    .map((office) => ({ id: office.code as OfficeId, uuid: office.id }));
  private readonly initialLocal = v2CreateLeadLocalDateTime(
    this.data.now,
    this.data.defaultOffice || 'warsaw',
  );
  private readonly initial: CreateLeadModel = {
    name: '',
    phone: '',
    email: '',
    showroom: this.data.defaultOffice,
    channel: 'office',
    referredBy: '',
    createdDate: this.initialLocal.date,
    createdTime: this.initialLocal.time,
    budget: '',
    currency: OFFICE_CONFIG[this.data.defaultOffice || 'warsaw'].defaultBudgetCurrency,
    location: '',
    request: '',
  };
  protected readonly model = signal<CreateLeadModel>({ ...this.initial });
  protected readonly lead = form(this.model);
  protected readonly products = signal<readonly V2LeadProduct[]>([]);
  protected readonly documents = signal<readonly V2PendingDocument[]>([]);
  private readonly createdLeadId = signal<string | null>(null);
  /** Once the lead exists its fields are final; only the failed files can be retried. */
  protected readonly locked = computed(() => this.createdLeadId() !== null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly attempted = signal(false);
  protected readonly phoneBlurred = signal(false);
  protected readonly emailBlurred = signal(false);
  protected readonly budgetBlurred = signal(false);
  private createdEdited = false;

  protected readonly selectedConfig = computed(
    () => OFFICE_CONFIG[this.model().showroom || 'warsaw'],
  );
  private readonly phoneValidation = computed(() => v2ValidatePhone(this.model().phone));
  private readonly createdValid = computed(() => {
    const value = `${this.model().createdDate}T${this.model().createdTime}`;
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
    const now = v2CreateLeadLocalDateTime(this.data.now, this.model().showroom || 'warsaw');
    return value <= `${now.date}T${now.time}`;
  });
  private readonly emailValid = computed(() => {
    const email = this.model().email.trim();
    return !email || EMAIL_PATTERN.test(email);
  });
  private readonly budgetValid = computed(() => isV2BudgetText(this.model().budget));

  protected readonly nameError = computed(() =>
    this.attempted() && !this.model().name.trim() ? this.i18n.t('v2.editContact.nameRequired') : '',
  );
  protected readonly phoneError = computed(() =>
    this.attempted() || this.phoneBlurred()
      ? phoneValidationMessage(this.phoneValidation(), this.i18n)
      : '',
  );
  protected readonly emailError = computed(() =>
    (this.attempted() || this.emailBlurred()) && !this.emailValid()
      ? this.i18n.t('v2.editContact.emailInvalid')
      : '',
  );
  protected readonly showroomError = computed(() =>
    this.attempted() && !this.model().showroom ? this.i18n.t('v2.createLead.showroomRequired') : '',
  );
  protected readonly referrerError = computed(() =>
    this.attempted() && this.model().channel === 'referral' && !this.model().referredBy.trim()
      ? this.i18n.t('v2.editContact.referrerRequired')
      : '',
  );
  protected readonly createdError = computed(() =>
    this.attempted() && !this.createdValid() ? this.i18n.t('v2.createLead.createdInvalid') : '',
  );
  protected readonly budgetError = computed(() =>
    (this.attempted() || this.budgetBlurred()) && !this.budgetValid()
      ? this.i18n.t('v2.leadInfo.budgetInvalid')
      : '',
  );
  protected readonly missingCount = computed(() => {
    let count = 0;
    if (!this.model().name.trim()) count++;
    if (this.phoneValidation().kind !== 'ok') count++;
    if (!this.emailValid()) count++;
    if (!this.model().showroom) count++;
    if (this.model().channel === 'referral' && !this.model().referredBy.trim()) count++;
    if (!this.createdValid()) count++;
    if (!this.budgetValid()) count++;
    count += v2DocumentLocalErrorCount(this.documents());
    return count;
  });
  protected readonly invalid = computed(() => this.missingCount() > 0);
  protected readonly hasUnsavedInput = computed(
    () =>
      JSON.stringify(this.model()) !== JSON.stringify(this.initial) ||
      this.products().length > 0 ||
      this.documents().length > 0,
  );

  protected selectShowroom(showroom: OfficeId): void {
    const next = this.createdEdited ? null : v2CreateLeadLocalDateTime(this.data.now, showroom);
    this.model.update((value) => ({
      ...value,
      showroom,
      currency: OFFICE_CONFIG[showroom].defaultBudgetCurrency,
      ...(next ? { createdDate: next.date, createdTime: next.time } : {}),
    }));
  }

  protected selectChannel(channel: V2CreateLeadChannel): void {
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

  protected setCreated(field: 'createdDate' | 'createdTime', event: Event): void {
    this.createdEdited = true;
    const value = (event.target as HTMLInputElement).value;
    this.model.update((model) => ({ ...model, [field]: value }));
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const request = this.request();
    if (!request) return;
    this.saving.set(true);
    this.saveError.set('');
    try {
      let leadId = this.createdLeadId();
      if (!leadId) {
        leadId = await this.service.create(request);
        this.createdLeadId.set(leadId);
        this.data.onCreated(leadId);
      }
      await this.documentsService.uploadAll(leadId, this.documents(), '', (id, change) =>
        this.documents.update((items) => v2UpdatePendingDocument(items, id, change)),
      );
      this.dialogRef.close(leadId);
    } catch (error) {
      const message = this.i18n.localizeError(
        error instanceof Error ? error.message : 'error.leadCreateFailed',
      );
      this.saveError.set(
        this.createdLeadId()
          ? `${this.i18n.t('v2.createLead.createdUploadFailed')} ${message}`
          : message,
      );
    } finally {
      this.saving.set(false);
    }
  }

  private request(): CreateLeadRequest | null {
    const value = this.model();
    const showroom = this.showroomOptions.find((option) => option.id === value.showroom);
    if (!showroom || !value.showroom) return null;
    const phone = v2StoredPhone(value.phone, value.showroom);
    if (!phone) return null;
    const products = this.products();
    return {
      officeId: showroom.uuid,
      source: v2CreateLeadLegacySource(value.channel),
      name: value.name.trim(),
      phone,
      email: value.email.trim() || null,
      cityRegion: value.location.trim(),
      productInterest: products.join(', '),
      estimatedBudgetCurrency: value.currency,
      initialMessage: value.request.trim(),
      sourceCreatedAtLocal: `${value.createdDate}T${value.createdTime}`,
      channel: value.channel,
      ...(value.channel === 'referral' ? { referredBy: value.referredBy.trim() } : {}),
      products: [...products],
      estimatedBudgetText: value.budget.trim(),
    };
  }
}

function phoneValidationMessage(result: V2PhoneValidation, i18n: I18nService): string {
  switch (result.kind) {
    case 'ok':
      return '';
    case 'empty':
      return i18n.t('v2.editContact.phoneRequired');
    case 'noCode':
      return i18n.t('v2.editContact.phoneCode');
    case 'incomplete':
      return i18n.t('v2.editContact.phoneIncomplete', { count: result.missingDigits });
  }
}
