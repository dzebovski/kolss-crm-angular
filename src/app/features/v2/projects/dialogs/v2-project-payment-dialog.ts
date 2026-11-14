import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { V2_PROJECT_CURRENCIES } from '@domain/v2/project-money';
import {
  V2_PAYMENT_BASES,
  v2AmountText,
  v2IsFutureDay,
  v2LocalDay,
  v2ParseAmount,
} from '@domain/v2/project-forms';
import type {
  V2Project,
  V2ProjectCurrency,
  V2ProjectPayment,
  V2ProjectPaymentBasis,
} from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { v2LiveNow } from '../../core/v2-clock';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2ChipSelect, type V2ChipOption } from '../../ui/v2-chip-select';
import { V2Select } from '../../ui/v2-select';
import { V2ProjectFileField } from './v2-project-file-field';
import { V2ProjectNotice } from './v2-project-notice';
import { V2_PAYMENT_BASIS_LABEL } from './v2-project-payment-labels';

export interface V2ProjectPaymentData {
  readonly project: V2Project;
  /** Set in edit mode. */
  readonly payment?: V2ProjectPayment;
}

interface PaymentModel {
  amount: string;
  currency: string;
  paidOn: string;
  basis: string;
  note: string;
}

const NOTE_MAX = 300;

// Add / edit payment (pipeline 4, owner decisions 2026-11-14; no board): a standalone record —
// amount + currency, date (not in the future), basis (receipt, invoice, contract, other), note
// and one optional receipt. Any amount; payments never move the stage. Closes with the updated
// project.
@Component({
  selector: 'app-v2-project-payment-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2ChipSelect,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2ProjectFileField,
    V2ProjectNotice,
    V2Select,
  ],
  templateUrl: './v2-project-payment-dialog.html',
  styles: `
    .v2-payment-popup__money {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--v2-space-3);
    }
  `,
})
export class V2ProjectPaymentDialog {
  private readonly dialogRef = inject<DialogRef<V2Project | null>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2ProjectPaymentData>(DIALOG_DATA);
  private readonly liveNow = v2LiveNow();

  private readonly project = this.data.project;
  protected readonly editing = !!this.data.payment;
  protected readonly subtitle = `${this.project.code} · ${this.project.clientName}`;

  protected readonly currencies = V2_PROJECT_CURRENCIES.map((code) => ({
    value: code,
    label: code,
  }));
  protected readonly bases: readonly V2ChipOption[] = V2_PAYMENT_BASES.map((basis) => ({
    id: basis,
    label: this.i18n.t(V2_PAYMENT_BASIS_LABEL[basis]),
  }));

  private readonly initial: PaymentModel = (() => {
    const payment = this.data.payment;
    if (payment) {
      return {
        amount: v2AmountText(payment.amount.amount, this.i18n.locale()),
        currency: payment.amount.currency,
        paidOn: payment.paidOn,
        basis: payment.basis,
        note: payment.note ?? '',
      };
    }
    return {
      amount: '',
      currency: this.project.estimate?.currency ?? this.project.paidTotals[0]?.currency ?? 'PLN',
      paidOn: v2LocalDay(this.liveNow()),
      basis: '',
      note: '',
    };
  })();

  protected readonly model = signal<PaymentModel>({ ...this.initial });
  protected readonly fields = form(this.model);
  protected readonly file = signal<File | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);
  /** One key per popup, so a retried save after a lost response is not stored twice. */
  private readonly idempotencyKey = crypto.randomUUID();

  private readonly errors = computed(() => {
    const value = this.model();
    const errors: Partial<Record<keyof PaymentModel, string>> = {};
    if (v2ParseAmount(value.amount) === null)
      errors.amount = this.i18n.t('v2.projectPopup.amountMissing');
    if (!value.basis) errors.basis = this.i18n.t('v2.projectPopup.payment.basisMissing');
    if (!value.paidOn) errors.paidOn = this.i18n.t('v2.projectPopup.payment.dateMissing');
    else if (v2IsFutureDay(value.paidOn, v2LocalDay(this.liveNow())))
      errors.paidOn = this.i18n.t('v2.projectPopup.payment.dateFuture');
    if (value.note.trim().length > NOTE_MAX)
      errors.note = this.i18n.t('v2.projectCard.commentTooLong', { max: NOTE_MAX });
    return errors;
  });

  protected readonly invalid = computed(() => Object.keys(this.errors()).length > 0);
  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);
  protected readonly shown = computed(() => (this.touched() ? this.errors() : {}));
  protected readonly hasUnsavedInput = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(this.initial) || this.file() !== null,
  );

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    if (this.editing && !this.hasUnsavedInput()) {
      this.dialogRef.close(null);
      return;
    }
    const value = this.model();
    const amount = v2ParseAmount(value.amount)!;
    const note = value.note.trim();
    const currency = value.currency as V2ProjectCurrency;
    const basis = value.basis as V2ProjectPaymentBasis;
    this.saving.set(true);
    this.error.set('');
    try {
      const chosen = this.file();
      const fileId = chosen
        ? await this.projects.uploadFile(this.project.id, 'receipt', chosen)
        : undefined;
      const payment = this.data.payment;
      const project = payment
        ? await this.projects.updatePayment(this.project.id, payment.id, {
            ...(amount !== payment.amount.amount && { amount }),
            ...(currency !== payment.amount.currency && { currency }),
            ...(value.paidOn !== payment.paidOn && { paidOn: value.paidOn }),
            ...(basis !== payment.basis && { basis }),
            ...(note !== (payment.note ?? '') && { note }),
            ...(fileId && { fileId }),
          })
        : await this.projects.addPayment(
            this.project.id,
            {
              amount,
              currency,
              paidOn: value.paidOn,
              basis,
              note: note || null,
              fileId: fileId ?? null,
            },
            this.idempotencyKey,
          );
      this.dialogRef.close(project);
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
