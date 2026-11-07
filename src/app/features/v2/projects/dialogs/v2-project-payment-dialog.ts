import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money } from '@domain/v2/project-money';
import {
  v2AddMoney,
  v2AmountText,
  v2IsFutureDay,
  v2LocalDay,
  v2ParseAmount,
  v2PaymentLimit,
  v2PaymentQuickAmounts,
} from '@domain/v2/project-forms';
import type {
  V2Project,
  V2ProjectContract,
  V2ProjectContractKind,
  V2ProjectPayment,
} from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { v2LiveNow } from '../../core/v2-clock';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2ChipSelect, type V2ChipOption } from '../../ui/v2-chip-select';
import { V2ProjectFileField } from './v2-project-file-field';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectPaymentData {
  readonly project: V2Project;
  /** The contract block the popup was opened from. */
  readonly kind?: V2ProjectContractKind;
  /** Set in edit mode. */
  readonly payment?: V2ProjectPayment;
}

interface PaymentModel {
  contract: string;
  amount: string;
  paidOn: string;
  note: string;
}

const NOTE_MAX = 300;

// Add / edit payment (Project-add-payment board, pipeline 3): to which contract (only when both
// still have something to pay), amount with quick amounts (500 / 1000 zł, 10%, up to 50%,
// remaining), date (not in the future), note and one optional receipt. Never above the remaining
// balance; payments never move the stage. Closes with the updated project.
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
  ],
  templateUrl: './v2-project-payment-dialog.html',
  styles: `
    .v2-payment-popup__quick {
      display: flex;
      flex-wrap: wrap;
      gap: var(--v2-space-2);
      margin-top: calc(var(--v2-space-2) * -1);
    }

    .v2-payment-popup__chip {
      height: 28px;
      padding: 0 10px;
      background: var(--v2-surface);
      border: 1px solid var(--v2-line-strong);
      border-radius: var(--v2-radius-pill);
      color: var(--v2-ink-2);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .v2-payment-popup__chip--on {
      background: var(--v2-ink);
      border-color: var(--v2-ink);
      color: var(--v2-on-ink);
    }

    .v2-payment-popup__chip:focus-visible {
      outline: 2px solid var(--v2-ink);
      outline-offset: 2px;
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

  /** Contracts a payment can go to: the edited payment's, or those with a balance left. */
  private readonly payable: readonly V2ProjectContract[] = (() => {
    const { intro, main } = this.project.contracts;
    const payment = this.data.payment;
    if (payment) {
      const own = this.project.contracts[payment.contractKind];
      return own ? [own] : [];
    }
    return [intro, main].filter(
      (contract): contract is V2ProjectContract => !!contract && contract.remaining.amount > 0,
    );
  })();

  protected readonly contractOptions: readonly V2ChipOption[] = this.payable.map((contract) => ({
    id: contract.kind,
    label: this.i18n.t(
      contract.kind === 'intro' ? 'v2.projectCard.intro.title' : 'v2.projectCard.main.title',
    ),
  }));

  private readonly initial: PaymentModel = (() => {
    const payment = this.data.payment;
    if (payment) {
      return {
        contract: payment.contractKind,
        amount: v2AmountText(payment.amount.amount, this.i18n.locale()),
        paidOn: payment.paidOn,
        note: payment.note ?? '',
      };
    }
    const preferred = this.payable.find((contract) => contract.kind === this.data.kind);
    const fallback = this.payable.find((contract) => contract.kind === 'main') ?? this.payable[0];
    return {
      contract: (preferred ?? fallback)?.kind ?? '',
      amount: '',
      paidOn: v2LocalDay(this.liveNow()),
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

  protected readonly contract = computed(
    () => this.payable.find((item) => item.kind === this.model().contract) ?? null,
  );
  private readonly limit = computed(() => {
    const contract = this.contract();
    return contract ? v2PaymentLimit(contract, this.data.payment?.amount.amount ?? 0) : 0;
  });

  protected readonly quick = computed(() => {
    const contract = this.contract();
    if (!contract || this.editing) return [];
    const locale = this.i18n.locale();
    return v2PaymentQuickAmounts(contract).map((quick) => {
      const money = formatV2Money({ ...contract.total, amount: quick.amount }, locale);
      const text = v2AmountText(quick.amount, locale);
      return {
        key: `${quick.kind}-${quick.amount}`,
        text,
        label:
          quick.kind === 'fixed'
            ? money
            : this.i18n.t(`v2.projectPopup.payment.quick.${quick.kind}`, { amount: money }),
      };
    });
  });

  protected readonly amountHint = computed(() => {
    const contract = this.contract();
    if (!contract) return '';
    return this.i18n.t('v2.projectPopup.payment.remaining', {
      amount: formatV2Money({ ...contract.total, amount: this.limit() }, this.i18n.locale()),
    });
  });

  private readonly errors = computed(() => {
    const value = this.model();
    const errors: Partial<Record<keyof PaymentModel, string>> = {};
    if (!this.contract()) errors.contract = this.i18n.t('v2.projectPopup.payment.pickContract');
    const amount = v2ParseAmount(value.amount);
    if (amount === null) errors.amount = this.i18n.t('v2.projectPopup.amountMissing');
    else if (this.contract() && amount > this.limit())
      errors.amount = this.i18n.t('v2.projectPopup.payment.overBalance', {
        amount: formatV2Money(
          { ...this.contract()!.total, amount: this.limit() },
          this.i18n.locale(),
        ),
      });
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

  /** "Paid after this: 25 000 zł of 50 000 zł" (credited intro included on the main contract). */
  protected readonly hint = computed(() => {
    const contract = this.contract();
    const amount = v2ParseAmount(this.model().amount);
    if (!contract || amount === null) return this.i18n.t('v2.projectPopup.timelineHint');
    const before =
      contract.paid.amount + contract.credited.amount - (this.data.payment?.amount.amount ?? 0);
    const locale = this.i18n.locale();
    return this.i18n.t('v2.projectPopup.payment.after', {
      paid: formatV2Money(v2AddMoney({ ...contract.total, amount: before }, amount), locale),
      total: formatV2Money(contract.total, locale),
    });
  });

  protected pickQuick(text: string): void {
    this.model.update((value) => ({ ...value, amount: text }));
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    if (this.editing && !this.hasUnsavedInput()) {
      this.dialogRef.close(null);
      return;
    }
    const value = this.model();
    const amount = v2ParseAmount(value.amount)!;
    const note = value.note.trim();
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
            ...(value.paidOn !== payment.paidOn && { paidOn: value.paidOn }),
            ...(note !== (payment.note ?? '') && { note }),
            ...(fileId && { fileId }),
          })
        : await this.projects.addPayment(
            this.project.id,
            {
              contractId: this.contract()!.id,
              amount,
              paidOn: value.paidOn,
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
