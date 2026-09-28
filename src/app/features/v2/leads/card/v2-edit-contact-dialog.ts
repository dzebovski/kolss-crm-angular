import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG, OFFICE_IDS } from '@core/office/office.config';
import { normalizePhoneForOffice } from '@core/phone/phone';
import type { ContractCurrency, Lead } from '@domain/lead.types';
import { isV2BudgetText } from '@domain/v2/lead-action';
import {
  v2DocumentLocalErrorCount,
  v2UpdatePendingDocument,
  type V2PendingDocument,
} from '@domain/v2/lead-documents';
import type { V2LeadCard, V2LeadColumns, V2LeadProduct } from '@domain/v2/lead-card.types';
import { v2ValidatePhone, type V2PhoneValidation } from '@domain/v2/phone-mask';
import type { V2LeadChannel } from '@domain/v2/lead-view.types';
import {
  V2EditContactPartialWriteError,
  V2LeadCardService,
  type V2ContactField,
  type V2ContactUpdate,
} from '@services/v2/v2-lead-card.service';
import { V2LeadDocumentsService } from '@services/v2/v2-lead-documents.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2BudgetInput } from '../../ui/v2-budget-input';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';
import { V2PhoneInput } from '../../ui/v2-phone-input';
import { V2DocumentPicker } from './v2-document-picker';
import { V2ProductChips } from './v2-product-chips';

export interface V2EditContactData {
  readonly lead: Lead;
  readonly card: V2LeadCard;
  readonly columns: V2LeadColumns;
}

interface ContactModel {
  name: string;
  phone: string;
  email: string;
  channel: V2LeadChannel;
  referredBy: string;
  budget: string;
  currency: ContractCurrency;
  location: string;
  aboutClient: string;
}

const PICKABLE_CHANNELS: readonly V2LeadChannel[] = [
  'office',
  'phone',
  'website',
  'meta_ads',
  'google_ads',
  'referral',
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

@Component({
  selector: 'app-v2-edit-contact-dialog',
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
  templateUrl: './v2-edit-contact-dialog.html',
  styleUrl: './v2-edit-contact-dialog.scss',
})
export class V2EditContactDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly documentsService = inject(V2LeadDocumentsService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2EditContactData>(DIALOG_DATA);

  protected readonly channelLabels = V2_CHANNEL_LABEL;
  protected readonly channels: readonly V2LeadChannel[] =
    this.data.card.channel === 'other' ? [...PICKABLE_CHANNELS, 'other'] : PICKABLE_CHANNELS;
  protected readonly officeConfig = OFFICE_CONFIG;
  protected readonly showrooms = OFFICE_IDS;
  protected readonly phoneCountryCode = OFFICE_CONFIG[this.data.lead.officeCode].phoneCountryCode;
  protected readonly phonePlaceholder = OFFICE_CONFIG[this.data.lead.officeCode].phonePlaceholder;

  private readonly initial: ContactModel = {
    name: this.data.card.name,
    phone: this.data.card.phone,
    email: this.data.card.email ?? '',
    channel: this.data.card.channel,
    referredBy: this.data.columns.referredBy ?? '',
    budget: this.data.columns.estimatedBudgetText ?? budgetFromV1(this.data.lead),
    currency: this.data.lead.estimatedBudgetCurrency,
    location: this.data.lead.cityRegion,
    aboutClient: this.data.columns.aboutClient ?? '',
  };
  protected readonly model = signal<ContactModel>({ ...this.initial });
  protected readonly contact = form(this.model);
  protected readonly products = signal<readonly V2LeadProduct[]>(this.data.columns.products);
  protected readonly documents = signal<readonly V2PendingDocument[]>([]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly attempted = signal(false);
  protected readonly phoneBlurred = signal(false);
  protected readonly emailBlurred = signal(false);
  protected readonly budgetBlurred = signal(false);

  private readonly phoneValidation = computed(() => v2ValidatePhone(this.model().phone));
  protected readonly nameError = computed(() =>
    this.attempted() && !this.model().name.trim() ? this.i18n.t('v2.editContact.nameRequired') : '',
  );
  protected readonly phoneError = computed(() => {
    const result = this.phoneValidation();
    if (!this.attempted() && !this.phoneBlurred()) return '';
    return phoneValidationMessage(result, this.i18n);
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
  protected readonly missingCount = computed(() => {
    let count = 0;
    if (!this.model().name.trim()) count++;
    if (this.phoneValidation().kind !== 'ok') count++;
    if (!this.emailValid()) count++;
    if (this.model().channel === 'referral' && !this.model().referredBy.trim()) count++;
    if (!this.budgetValid()) count++;
    count += v2DocumentLocalErrorCount(this.documents());
    return count;
  });
  protected readonly invalid = computed(() => this.missingCount() > 0);
  protected readonly changeCount = computed(() => this.countChanges());
  protected readonly footerHint = computed(() => {
    const count = this.changeCount();
    if (!count) return this.i18n.t('v2.editContact.noChanges');
    return this.i18n.t(count === 1 ? 'v2.editContact.oneChange' : 'v2.editContact.manyChanges', {
      count,
    });
  });
  protected readonly hasUnsavedInput = computed(
    () => this.changeCount() > 0 || this.documents().length > 0,
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

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const contact = this.contactUpdate();
    const editedFields = changedContactFields(this.initialContactUpdate(), contact);
    const info = this.infoChanges();
    if (!editedFields.length && !Object.keys(info).length && this.documents().length === 0) {
      this.dialogRef.close(false);
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.documentsService.uploadAll(this.data.lead.id, this.documents(), '', (id, change) =>
        this.documents.update((items) => v2UpdatePendingDocument(items, id, change)),
      );
      if (editedFields.length || Object.keys(info).length) {
        await this.service.editContactAndRequest(this.data.lead, {
          contact,
          editedFields,
          info,
        });
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.saveError.set(
        error instanceof V2EditContactPartialWriteError
          ? this.i18n.t('v2.editContact.partialSave')
          : this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private emailValid(): boolean {
    const email = this.model().email.trim();
    return !email || EMAIL_PATTERN.test(email);
  }

  private budgetValid(): boolean {
    return isV2BudgetText(this.model().budget);
  }

  private persistedReferrer(value = this.model()): string {
    return value.channel === 'referral' ? value.referredBy.trim() : '';
  }

  private contactUpdate(): V2ContactUpdate {
    const value = this.model();
    return {
      name: value.name.trim(),
      phone: normalizePhoneForOffice(value.phone, this.data.lead.officeCode) ?? value.phone.trim(),
      email: value.email.trim() || null,
      managerId: this.data.lead.assignedToId,
      channel: value.channel,
    };
  }

  private initialContactUpdate(): V2ContactUpdate {
    return {
      name: this.data.card.name,
      phone:
        normalizePhoneForOffice(this.data.card.phone, this.data.lead.officeCode) ??
        this.data.card.phone,
      email: this.data.card.email,
      managerId: this.data.lead.assignedToId,
      channel: this.data.card.channel,
    };
  }

  private infoChanges() {
    const value = this.model();
    const products = this.products();
    const initialReferrer =
      this.initial.channel === 'referral' ? this.initial.referredBy.trim() : '';
    const nextReferrer = this.persistedReferrer(value);
    return {
      ...(nextReferrer !== initialReferrer ? { referredBy: nextReferrer } : {}),
      ...(value.budget.trim() !== this.initial.budget.trim()
        ? { estimatedBudgetText: value.budget.trim() }
        : {}),
      ...(value.currency !== this.initial.currency
        ? { estimatedBudgetCurrency: value.currency }
        : {}),
      ...(value.location.trim() !== this.initial.location.trim()
        ? { cityRegion: value.location.trim() }
        : {}),
      ...(sameProducts(products, this.data.columns.products) ? {} : { products: [...products] }),
      ...(value.aboutClient.trim() !== this.initial.aboutClient.trim()
        ? { aboutClient: value.aboutClient.trim() }
        : {}),
    };
  }

  private countChanges(): number {
    const value = this.model();
    let count = 0;
    if (value.name.trim() !== this.initial.name.trim()) count++;
    if (
      (normalizePhoneForOffice(value.phone, this.data.lead.officeCode) ?? value.phone.trim()) !==
      (normalizePhoneForOffice(this.initial.phone, this.data.lead.officeCode) ?? this.initial.phone)
    )
      count++;
    if ((value.email.trim() || null) !== (this.initial.email.trim() || null)) count++;
    if (value.channel !== this.initial.channel) count++;
    if (this.persistedReferrer(value) !== this.persistedReferrer(this.initial)) count++;
    if (!sameProducts(this.products(), this.data.columns.products)) count++;
    if (value.budget.trim() !== this.initial.budget.trim()) count++;
    if (value.currency !== this.initial.currency) count++;
    if (value.location.trim() !== this.initial.location.trim()) count++;
    if (value.aboutClient.trim() !== this.initial.aboutClient.trim()) count++;
    return count;
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

function changedContactFields(before: V2ContactUpdate, after: V2ContactUpdate): V2ContactField[] {
  const fields: V2ContactField[] = [];
  if (before.name !== after.name) fields.push('name');
  if (before.phone !== after.phone) fields.push('phone');
  if (before.email !== after.email) fields.push('email');
  if (before.channel !== after.channel) fields.push('channel');
  return fields;
}

function budgetFromV1(lead: Lead): string {
  return lead.estimatedBudget == null ? '' : String(lead.estimatedBudget);
}

function sameProducts(a: readonly V2LeadProduct[], b: readonly V2LeadProduct[]): boolean {
  return a.length === b.length && a.every((product) => b.includes(product));
}
