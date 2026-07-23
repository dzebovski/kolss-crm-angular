import { Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';

import type { LeadFieldKey } from '../../../core/i18n/field-keys';
import { I18nService } from '../../../core/i18n/i18n.service';
import { normalizePhoneForOffice } from '../../../core/phone/phone';
import type { MockLead } from '../../../services/crm-mock.types';
import { type LeadDetailsUpdate, LeadsService } from '../../../services/leads.service';
import { UiButton } from '../../../ui/button/ui-button';
import { UiModal } from '../../../ui/dialog/ui-modal';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiTextarea } from '../../../ui/form/ui-textarea';

interface EditLeadFormModel {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly cityRegion: string;
  readonly productInterest: string;
  readonly budget: string;
  readonly initialMessage: string;
}

@Component({
  selector: 'app-edit-lead-dialog',
  imports: [FormField, UiButton, UiModal, UiTextField, UiTextarea],
  template: `
    <app-ui-modal [wide]="true" labelledBy="edit-lead-dialog-title" (dismissed)="dismiss()">
      <div class="dialog-copy">
        <h2 id="edit-lead-dialog-title">{{ i18n.t('lead.editLeadTitle') }}</h2>
        <p>{{ i18n.t('lead.editLeadHint') }}</p>
      </div>

      @if (error()) {
        <div class="inline-error" role="alert">{{ error() }}</div>
      }

      <form class="edit-lead-form" (submit)="save($event)">
        <section class="form-section" [attr.aria-labelledby]="'edit-lead-contacts-title'">
          <h3 id="edit-lead-contacts-title">{{ i18n.t('lead.contacts') }}</h3>
          <div class="form-grid">
            <app-ui-text-field
              [formField]="editForm.name"
              [label]="i18n.t('common.name')"
              [error]="fieldError(editForm.name)"
            />
            <app-ui-text-field
              [formField]="editForm.phone"
              [label]="i18n.t('common.phone')"
              type="tel"
              [error]="fieldError(editForm.phone)"
            />
            <app-ui-text-field
              [formField]="editForm.email"
              [label]="i18n.t('common.email')"
              type="email"
              [error]="fieldError(editForm.email)"
            />
            <app-ui-text-field
              [formField]="editForm.cityRegion"
              [label]="i18n.t('common.cityRegion')"
            />
          </div>
        </section>

        <section class="form-section" [attr.aria-labelledby]="'edit-lead-data-title'">
          <h3 id="edit-lead-data-title">{{ i18n.t('lead.leadData') }}</h3>
          <div class="form-grid">
            <app-ui-text-field
              [formField]="editForm.productInterest"
              [label]="i18n.t('common.product')"
            />
            <app-ui-text-field
              [formField]="editForm.budget"
              [label]="i18n.t('common.budgetEur')"
              [error]="fieldError(editForm.budget)"
            />
          </div>
          <app-ui-textarea
            [formField]="editForm.initialMessage"
            [label]="i18n.t('lead.initialMessage')"
            [rows]="4"
          />
        </section>

        <div class="dialog-actions">
          <app-ui-button variant="ghost" [disabled]="editForm().submitting()" (pressed)="dismiss()">
            {{ i18n.t('common.cancel') }}
          </app-ui-button>
          <app-ui-button type="submit" [loading]="editForm().submitting()">
            {{ i18n.t('common.save') }}
          </app-ui-button>
        </div>
      </form>
    </app-ui-modal>
  `,
  styles: `
    .dialog-copy,
    .dialog-copy h2,
    .dialog-copy p {
      margin: 0;
    }

    .dialog-copy {
      display: grid;
      gap: var(--ui-space-2);
    }

    .dialog-copy p {
      color: var(--ui-text-muted);
      font-size: 0.875rem;
    }

    .inline-error {
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid color-mix(in srgb, var(--ui-danger) 24%, white);
      border-radius: var(--ui-radius-md);
      background: var(--ui-danger-soft);
      color: var(--ui-danger);
      font-size: 0.875rem;
      font-weight: 650;
    }

    .edit-lead-form,
    .form-section {
      display: grid;
    }

    .edit-lead-form {
      gap: var(--ui-space-5);
    }

    .form-section {
      gap: var(--ui-space-3);
    }

    .form-section + .form-section {
      padding-top: var(--ui-space-4);
      border-top: 1px solid var(--ui-border);
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
      align-items: start;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--ui-space-2);
    }

    @media (max-width: 48rem) {
      .form-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class EditLeadDialog {
  private readonly leadsService = inject(LeadsService);
  protected readonly i18n = inject(I18nService);

  readonly lead = input.required<MockLead>();
  readonly dismissed = output<void>();
  readonly saved = output<void>();

  protected readonly error = signal('');
  protected readonly model = linkedSignal<EditLeadFormModel>(() => this.initialModel(this.lead()));
  protected readonly editForm = form(this.model, (path) => {
    required(path.name, { message: this.i18n.t('lead.nameRequired') });
    validate(path.name, ({ value }) =>
      value().trim() ? undefined : { kind: 'required', message: this.i18n.t('lead.nameRequired') },
    );
    required(path.phone, { message: this.i18n.t('lead.phoneRequired') });
    validate(path.phone, ({ value }) => {
      const phone = value().trim();
      if (!phone) return;
      return normalizePhoneForOffice(phone, this.lead().officeCode)
        ? undefined
        : { kind: 'phone', message: this.i18n.t('lead.phoneInvalid') };
    });
    validate(path.email, ({ value }) => {
      const email = value().trim();
      return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? undefined
        : { kind: 'email', message: this.i18n.t('lead.emailInvalid') };
    });
    validate(path.budget, ({ value }) => {
      const budget = this.parseOptionalMoney(value());
      return Number.isNaN(budget) || (budget != null && budget < 0)
        ? { kind: 'budget', message: this.i18n.t('lead.budgetInvalid') }
        : undefined;
    });
  });

  protected fieldError(field: typeof this.editForm.name): string {
    const state = field();
    if (!state.touched()) return '';
    return state.errors()[0]?.message ?? '';
  }

  protected dismiss(): void {
    if (this.editForm().submitting()) return;
    this.dismissed.emit();
  }

  protected async save(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.editForm().submitting()) return;
    this.error.set('');

    await submit(this.editForm, async () => {
      const lead = this.lead();
      const value = this.model();
      const phone = normalizePhoneForOffice(value.phone, lead.officeCode);
      if (!phone) return;

      const payload: LeadDetailsUpdate = {
        name: value.name.trim(),
        phone,
        email: this.nullableText(value.email),
        cityRegion: value.cityRegion.trim(),
        productInterest: value.productInterest.trim(),
        estimatedBudget: this.parseOptionalMoney(value.budget),
        initialMessage: value.initialMessage.trim(),
        assignedToId: lead.assignedToId ?? null,
      };
      const changedFields = this.changedFields(lead, payload);
      if (!changedFields.length) {
        this.dismissed.emit();
        return;
      }

      try {
        await this.leadsService.updateLeadDetails(lead.id, payload, changedFields);
        this.saved.emit();
      } catch (error) {
        this.error.set(
          error instanceof Error ? error.message : this.i18n.t('lead.saveChangesFailed'),
        );
      }
    });
  }

  private initialModel(lead: MockLead): EditLeadFormModel {
    return {
      name: lead.name === 'Без імені' ? '' : lead.name,
      phone: lead.phone === '—' ? '' : lead.phone,
      email: lead.email ?? '',
      cityRegion: lead.cityRegion,
      productInterest: lead.productInterest,
      budget: lead.estimatedBudget == null ? '' : String(lead.estimatedBudget),
      initialMessage: lead.initialMessage,
    };
  }

  private changedFields(lead: MockLead, payload: LeadDetailsUpdate): readonly LeadFieldKey[] {
    const fields: LeadFieldKey[] = [];
    if ((lead.name === 'Без імені' ? '' : lead.name) !== payload.name) fields.push('name');
    if ((lead.phone === '—' ? '' : lead.phone) !== payload.phone) fields.push('phone');
    if ((lead.email ?? null) !== payload.email) fields.push('email');
    if (lead.cityRegion !== payload.cityRegion) fields.push('cityRegion');
    if (lead.productInterest !== payload.productInterest) fields.push('product');
    if ((lead.estimatedBudget ?? null) !== payload.estimatedBudget) fields.push('budget');
    if (lead.initialMessage !== payload.initialMessage) fields.push('initialMessage');
    return fields;
  }

  private nullableText(value: string): string | null {
    const text = value.trim();
    return text || null;
  }

  private parseOptionalMoney(value: string): number | null {
    const normalized = value.trim();
    return normalized ? Number(normalized.replace(/\s/g, '').replace(',', '.')) : null;
  }
}
