import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { normalizePhoneForOffice } from '@core/phone/phone';
import { isSuperAdminRole } from '@core/roles/roles';
import type { Lead } from '@domain/lead.types';
import { joinV2Name, splitV2Name } from '@domain/v2/lead-card.mapper';
import type { V2LeadCard } from '@domain/v2/lead-card.types';
import type { V2LeadChannel } from '@domain/v2/lead-view.types';
import type { CrmEmployee } from '@services/users.service';
import {
  V2LeadCardService,
  type V2ContactField,
  type V2ContactUpdate,
} from '@services/v2/v2-lead-card.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2_CHANNEL_LABEL } from '../../ui/v2-lead-labels';

export interface V2EditContactData {
  readonly lead: Lead;
  readonly card: V2LeadCard;
  readonly employees: readonly CrmEmployee[];
  /** The API lets only a super admin change the manager (`lead_assign_forbidden`). */
  readonly canAssignManager: boolean;
}

interface ContactModel {
  first: string;
  last: string;
  phone: string;
  email: string;
  managerId: string;
  channel: V2LeadChannel;
}

/** Channels a person can pick (design `e-ch` select); `other` stays only on old imports. */
const PICKABLE_CHANNELS: readonly V2LeadChannel[] = [
  'referral',
  'phone',
  'office',
  'website',
  'meta_ads',
  'google_ads',
];
const NO_MANAGER = '';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Edit contact info popup from lead card v1.3 (Modal `edit`): First name *, Last name, Phone *,
// E-mail, Manager, Channel, then the note about the code and region. Saves through
// `PATCH /v1/leads/{id}`; the API writes the `lead_edited` timeline event with the changed
// fields. Closes with `true` after a save.
@Component({
  selector: 'app-v2-edit-contact-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField],
  template: `
    <app-v2-dialog
      [title]="'v2.editContact.title' | translate"
      [subtitle]="'v2.editContact.subtitle' | translate"
      [hint]="'v2.dialog.autoAuthor' | translate"
      [saveLabel]="'v2.editContact.save' | translate"
      [saveDisabled]="saving()"
      [invalid]="invalid()"
      [errorCount]="errorCount()"
      [hasUnsavedInput]="hasUnsavedInput()"
      (save)="save()"
      (invalidAttempt)="touched.set(true)"
    >
      @if (error(); as message) {
        <p class="v2-edit-contact__error" role="alert">{{ message }}</p>
      }

      <div class="v2-edit-contact__pair">
        <app-v2-form-field
          [label]="'v2.editContact.firstName' | translate"
          [required]="true"
          [error]="
            touched() && contact.first().errors().length
              ? ('v2.dialog.fieldRequired' | translate)
              : ''
          "
        >
          <input cdkFocusInitial autocomplete="off" [formField]="contact.first" />
        </app-v2-form-field>
        <app-v2-form-field [label]="'v2.editContact.lastName' | translate">
          <input autocomplete="off" [formField]="contact.last" />
        </app-v2-form-field>
      </div>

      <div class="v2-edit-contact__pair">
        <app-v2-form-field
          [label]="'v2.card.phone' | translate"
          [required]="true"
          [error]="
            touched() && contact.phone().errors().length
              ? ('v2.dialog.fieldRequired' | translate)
              : ''
          "
        >
          <input type="tel" autocomplete="off" [formField]="contact.phone" />
        </app-v2-form-field>
        <app-v2-form-field [label]="'v2.card.email' | translate">
          <input type="email" autocomplete="off" [formField]="contact.email" />
        </app-v2-form-field>
      </div>

      <div class="v2-edit-contact__pair">
        <app-v2-form-field [label]="'v2.card.manager' | translate">
          <select [formField]="contact.managerId">
            @for (option of managerOptions(); track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </app-v2-form-field>
        <app-v2-form-field [label]="'v2.editContact.channel' | translate">
          <select [formField]="contact.channel">
            @for (channel of channels; track channel) {
              <option [value]="channel">{{ channelLabels[channel] | translate }}</option>
            }
          </select>
        </app-v2-form-field>
      </div>

      <p class="v2-edit-contact__note">
        {{ 'v2.editContact.note' | translate: { code: data.card.code } }}
      </p>
    </app-v2-dialog>
  `,
  styles: `
    .v2-edit-contact__pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--v2-space-3);
    }

    .v2-edit-contact__note {
      margin: 0;
      color: var(--v2-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    // No error style in the design: the same notice as the impersonation popup.
    .v2-edit-contact__error {
      margin: 0;
      padding: 10px var(--v2-space-3);
      background: var(--v2-danger-bg);
      border-radius: var(--v2-radius-sm);
      color: var(--v2-danger);
      font-size: 13px;
      font-weight: 500;
    }

    @media (max-width: 480px) {
      .v2-edit-contact__pair {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class V2EditContactDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly service = inject(V2LeadCardService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2EditContactData>(DIALOG_DATA);

  protected readonly channelLabels = V2_CHANNEL_LABEL;
  protected readonly channels: readonly V2LeadChannel[] =
    this.data.card.channel === 'other' ? [...PICKABLE_CHANNELS, 'other'] : PICKABLE_CHANNELS;

  private readonly initial: ContactModel = {
    ...splitV2Name(this.data.card.name),
    phone: this.data.card.phone,
    email: this.data.card.email ?? '',
    managerId: this.data.card.managerId ?? NO_MANAGER,
    channel: this.data.card.channel,
  };
  private readonly model = signal<ContactModel>({ ...this.initial });
  protected readonly contact = form(this.model, (path) => {
    required(path.first);
    required(path.phone);
    disabled(path.managerId, () => !this.data.canAssignManager);
  });

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  /** Set once Save is pressed while invalid; required-field errors stay hidden until then. */
  protected readonly touched = signal(false);
  protected readonly errorCount = computed(
    () =>
      [this.contact.first, this.contact.phone].filter((field) => field().errors().length > 0)
        .length,
  );
  protected readonly invalid = computed(() => this.errorCount() > 0);
  protected readonly hasUnsavedInput = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(this.initial),
  );

  /**
   * Active staff of the lead's office (as the v1 manager picker), plus the current manager and
   * "Unassigned" when that's the current state. Locked unless the viewer may reassign.
   */
  protected readonly managerOptions = computed(() => {
    const { lead, card, employees } = this.data;
    const staff = employees.filter(
      (employee) =>
        employee.id === card.managerId ||
        (employee.status === 'active' &&
          !isSuperAdminRole(employee.role) &&
          employee.officeIds.includes(lead.officeCode)),
    );
    const options = staff.map((employee) => ({ value: employee.id, label: employee.displayName }));
    return card.managerId
      ? options
      : [{ value: NO_MANAGER, label: this.i18n.t('common.unassigned') }, ...options];
  });

  protected async save(): Promise<void> {
    if (this.saving() || !this.contact().valid()) return;
    this.error.set('');
    const value = this.model();
    const { lead } = this.data;

    const name = joinV2Name(value.first, value.last);
    if (!value.first.trim()) {
      this.error.set(this.i18n.t('lead.nameRequired'));
      return;
    }
    const phone = normalizePhoneForOffice(value.phone, lead.officeCode);
    if (!phone) {
      this.error.set(this.i18n.t('lead.phoneInvalid'));
      return;
    }
    const email = value.email.trim();
    if (email && !EMAIL_PATTERN.test(email)) {
      this.error.set(this.i18n.t('lead.emailInvalid'));
      return;
    }

    const update: V2ContactUpdate = {
      name,
      phone,
      email: email || null,
      managerId: this.data.canAssignManager ? value.managerId || null : lead.assignedToId,
      channel: value.channel,
    };
    const fields = changedFields(this.initialUpdate(), update);
    if (!fields.length) {
      this.dialogRef.close(false);
      return;
    }

    this.saving.set(true);
    try {
      await this.service.updateContact(lead, update, fields);
      this.dialogRef.close(true);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? this.i18n.localizeError(error.message)
          : this.i18n.t('lead.saveChangesFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private initialUpdate(): V2ContactUpdate {
    const { lead, card } = this.data;
    return {
      name: card.name,
      phone: normalizePhoneForOffice(card.phone, lead.officeCode) ?? card.phone,
      email: card.email,
      managerId: lead.assignedToId,
      channel: card.channel,
    };
  }
}

function changedFields(before: V2ContactUpdate, after: V2ContactUpdate): V2ContactField[] {
  const fields: V2ContactField[] = [];
  if (before.name !== after.name) fields.push('name');
  if (before.phone !== after.phone) fields.push('phone');
  if (before.email !== after.email) fields.push('email');
  if (before.managerId !== after.managerId) fields.push('manager');
  if (before.channel !== after.channel) fields.push('channel');
  return fields;
}
