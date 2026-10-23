import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { OFFICE_CONFIG } from '@core/office/office.config';
import {
  v2ClientApiPhone,
  v2ClientChangeCount,
  v2ClientChanges,
  v2ClientFormFrom,
  V2_CLIENT_LANGUAGES,
  type V2ClientForm,
} from '@domain/v2/client-form';
import type { V2Client } from '@domain/v2/client.types';
import { v2PluralCategory } from '@domain/v2/plural';
import { v2ValidatePhone, type V2PhoneValidation } from '@domain/v2/phone-mask';
import { V2ClientsService } from '@services/v2/v2-clients.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2PhoneInput } from '../../ui/v2-phone-input';

export interface V2ClientEditData {
  readonly client: V2Client;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const LANGUAGE_KEY = {
  pl: 'v2.client.lang.pl',
  uk: 'v2.client.lang.uk',
  en: 'v2.client.lang.en',
  ru: 'v2.client.lang.ru',
} as const;

// Edit client popup (Client-edit.dc.html and Client-edit-errors): the client's contact details,
// shared by all its leads and projects. Phones use the Create lead mask (+48 / +380, Q-CL5
// default). Saves only the changed fields with the loaded `version`; closes with `true` when
// something was saved.
@Component({
  selector: 'app-v2-client-edit-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField, V2PhoneInput],
  templateUrl: './v2-client-edit-dialog.html',
  styleUrl: './v2-client-edit-dialog.scss',
})
export class V2ClientEditDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2ClientsService);
  private readonly i18n = inject(I18nService);
  protected readonly client = inject<V2ClientEditData>(DIALOG_DATA).client;

  private readonly config = OFFICE_CONFIG[this.client.officeId];
  protected readonly phoneCountryCode = this.config.phoneCountryCode;
  protected readonly phonePlaceholder = this.config.phonePlaceholder;
  protected readonly languages = V2_CLIENT_LANGUAGES.map((value) => ({
    value,
    labelKey: LANGUAGE_KEY[value],
  }));

  protected readonly model = signal<V2ClientForm>(v2ClientFormFrom(this.client));
  protected readonly fields = form(this.model);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly attempted = signal(false);
  protected readonly phoneBlurred = signal(false);
  protected readonly phone2Blurred = signal(false);
  protected readonly emailBlurred = signal(false);

  private readonly phoneValidation = computed(() => v2ValidatePhone(this.model().phone));
  private readonly phone2Valid = computed(() => {
    const value = this.model().secondPhone;
    return !value.trim() || v2ClientApiPhone(value) !== null;
  });
  private readonly emailValid = computed(() => {
    const email = this.model().email.trim();
    return !email || EMAIL_PATTERN.test(email);
  });

  protected readonly nameError = computed(() =>
    this.attempted() && !this.model().name.trim() ? this.i18n.t('v2.editContact.nameRequired') : '',
  );
  protected readonly phoneError = computed(() =>
    this.attempted() || this.phoneBlurred()
      ? phoneValidationMessage(this.phoneValidation(), this.i18n)
      : '',
  );
  protected readonly phone2Error = computed(() =>
    (this.attempted() || this.phone2Blurred()) && !this.phone2Valid()
      ? this.i18n.t('v2.client.edit.phone2Incomplete')
      : '',
  );
  protected readonly emailError = computed(() =>
    (this.attempted() || this.emailBlurred()) && !this.emailValid()
      ? this.i18n.t('v2.editContact.emailInvalid')
      : '',
  );
  protected readonly missingCount = computed(
    () =>
      [
        !this.model().name.trim(),
        this.phoneValidation().kind !== 'ok',
        !this.phone2Valid(),
        !this.emailValid(),
      ].filter(Boolean).length,
  );
  protected readonly invalid = computed(() => this.missingCount() > 0);
  protected readonly changeCount = computed(() => v2ClientChangeCount(this.model(), this.client));
  protected readonly footerHint = computed(() => {
    const count = this.changeCount();
    if (!count) return this.i18n.t('v2.editContact.noChanges');
    const locale = this.i18n.locale();
    return this.i18n.t('v2.client.edit.footer', {
      changes: this.i18n.t(
        count === 1 ? 'v2.client.edit.oneChange' : 'v2.client.edit.manyChanges',
        {
          count,
        },
      ),
      leads: `${this.client.leads.length} ${this.i18n.t(`v2.clients.leads.${v2PluralCategory(locale, this.client.leads.length)}`)}`,
      projects: `${this.client.projects.length} ${this.i18n.t(`v2.clients.projects.${v2PluralCategory(locale, this.client.projects.length)}`)}`,
    });
  });
  protected readonly counts = computed(() => {
    const locale = this.i18n.locale();
    const leads = this.client.leads.length;
    const projects = this.client.projects.length;
    return `${leads} ${this.i18n.t(`v2.clients.leads.${v2PluralCategory(locale, leads)}`)} · ${projects} ${this.i18n.t(`v2.clients.projects.${v2PluralCategory(locale, projects)}`)}`;
  });

  protected setPhone(phone: string): void {
    this.model.update((value) => ({ ...value, phone }));
  }

  protected setSecondPhone(secondPhone: string): void {
    this.model.update((value) => ({ ...value, secondPhone }));
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const changes = v2ClientChanges(this.model(), this.client);
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close(false);
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.service.update(this.client.id, changes, this.client.version);
      this.dialogRef.close(true);
    } catch (error) {
      this.saveError.set(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof KolssApiError && error.code === 'version_conflict') {
      return this.i18n.t('v2.client.edit.conflict');
    }
    if (error instanceof KolssApiError && error.code === 'client_merged') {
      return this.i18n.t('v2.client.edit.mergedAway');
    }
    return this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed');
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
