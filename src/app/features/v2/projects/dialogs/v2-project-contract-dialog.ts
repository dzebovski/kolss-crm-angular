import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { disabled, form, FormField } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money, V2_PROJECT_CURRENCIES } from '@domain/v2/project-money';
import {
  v2AmountText,
  v2DefaultCurrency,
  v2IsFutureDay,
  v2LocalDay,
  v2ParseAmount,
} from '@domain/v2/project-forms';
import { v2ProjectStageIndex, v2ProjectStatusLabelKey } from '@domain/v2/project-status';
import type {
  V2Project,
  V2ProjectContract,
  V2ProjectContractKind,
  V2ProjectCurrency,
} from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { v2LiveNow } from '../../core/v2-clock';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FieldGroup } from '../../ui/dialog/v2-field-group';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2Select } from '../../ui/v2-select';
import { V2ProjectFileField } from './v2-project-file-field';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectContractData {
  readonly project: V2Project;
  readonly kind: V2ProjectContractKind;
  /** Set in edit mode. */
  readonly contract?: V2ProjectContract;
}

interface ContractModel {
  number: string;
  signedOn: string;
  total: string;
  currency: string;
}

const NUMBER_MAX = 60;

const TITLE: Record<V2ProjectContractKind, { add: MessageKey; edit: MessageKey }> = {
  intro: { add: 'v2.projectCard.intro.add', edit: 'v2.projectPopup.contract.editIntro' },
  main: { add: 'v2.projectCard.main.add', edit: 'v2.projectPopup.contract.editMain' },
};

// Add / edit contract (Project-add-contract board, pipeline 3): number, signing date (not in the
// future), total + currency, one optional file. The intro total is prefilled from the office
// default (Legionowo 500 zł, Kyiv none — Q-P15c). Adding moves the stage forward to Intro /
// Main contract (API). The currency is locked while payments exist. Closes with the project.
@Component({
  selector: 'app-v2-project-contract-dialog',
  imports: [
    FormField,
    TranslatePipe,
    V2DialogShell,
    V2FieldGroup,
    V2FormField,
    V2ProjectFileField,
    V2ProjectNotice,
    V2Select,
  ],
  templateUrl: './v2-project-contract-dialog.html',
  styles: `
    .v2-contract-popup__row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--v2-space-3);
    }

    @media (max-width: 560px) {
      .v2-contract-popup__row {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class V2ProjectContractDialog {
  private readonly dialogRef = inject<DialogRef<V2Project | null>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  protected readonly data = inject<V2ProjectContractData>(DIALOG_DATA);
  private readonly liveNow = v2LiveNow();

  private readonly project = this.data.project;
  protected readonly editing = !!this.data.contract;
  protected readonly subtitle = `${this.project.code} · ${this.project.clientName}`;
  protected readonly currencies = V2_PROJECT_CURRENCIES.map((code) => ({
    value: code,
    label: code,
  }));
  protected readonly currencyLocked = (this.data.contract?.paid.amount ?? 0) > 0;

  private readonly initial: ContractModel = (() => {
    const contract = this.data.contract;
    const locale = this.i18n.locale();
    if (contract) {
      return {
        number: contract.number,
        signedOn: contract.signedOn,
        total: v2AmountText(contract.total.amount, locale),
        currency: contract.total.currency,
      };
    }
    const intro = this.data.kind === 'intro' ? this.project.introDefault : null;
    const other = this.project.contracts[this.data.kind === 'intro' ? 'main' : 'intro'];
    return {
      number: '',
      signedOn: v2LocalDay(this.liveNow()),
      total: intro ? v2AmountText(intro.amount, locale) : '',
      currency: other?.total.currency ?? v2DefaultCurrency(this.project.introDefault),
    };
  })();

  protected readonly model = signal<ContractModel>({ ...this.initial });
  protected readonly fields = form(this.model, (path) => {
    disabled(path.currency, () => this.currencyLocked);
  });
  protected readonly file = signal<File | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);
  /** One key per popup, so a retried save after a lost response is not stored twice. */
  private readonly idempotencyKey = crypto.randomUUID();

  protected readonly title = computed(() =>
    this.editing ? TITLE[this.data.kind].edit : TITLE[this.data.kind].add,
  );

  /** Main contract: the paid intro amount is credited automatically. */
  protected readonly creditNote = computed(() => {
    const intro = this.project.contracts.intro;
    if (this.data.kind !== 'main' || !intro || intro.paid.amount <= 0) return null;
    return this.i18n.t('v2.projectPopup.contract.credit', {
      amount: formatV2Money(intro.paid, this.i18n.locale()),
    });
  });

  private readonly errors = computed(() => {
    const value = this.model();
    const errors: Partial<Record<keyof ContractModel, string>> = {};
    if (!value.number.trim()) errors.number = this.i18n.t('v2.projectPopup.contract.numberMissing');
    else if (value.number.trim().length > NUMBER_MAX)
      errors.number = this.i18n.t('v2.projectCard.commentTooLong', { max: NUMBER_MAX });
    if (!value.signedOn) errors.signedOn = this.i18n.t('v2.projectPopup.contract.dateMissing');
    else if (v2IsFutureDay(value.signedOn, v2LocalDay(this.liveNow())))
      errors.signedOn = this.i18n.t('v2.projectPopup.contract.dateFuture');
    if (v2ParseAmount(value.total) === null)
      errors.total = this.i18n.t('v2.projectPopup.amountMissing');
    return errors;
  });

  protected readonly invalid = computed(() => Object.keys(this.errors()).length > 0);
  protected readonly errorCount = computed(() => Object.keys(this.errors()).length);
  protected readonly shown = computed(() => (this.touched() ? this.errors() : {}));
  protected readonly hasUnsavedInput = computed(
    () => JSON.stringify(this.model()) !== JSON.stringify(this.initial) || this.file() !== null,
  );

  protected readonly hint = computed(() => {
    const target = this.data.kind === 'intro' ? 'intro_contract' : 'main_contract';
    if (!this.editing && v2ProjectStageIndex(this.project.status) < v2ProjectStageIndex(target)) {
      return this.i18n.t('v2.projectPopup.contract.moves', {
        status: this.i18n.t(v2ProjectStatusLabelKey(target)),
      });
    }
    return this.i18n.t('v2.projectPopup.timelineHint');
  });

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    if (this.editing && !this.hasUnsavedInput()) {
      this.dialogRef.close(null);
      return;
    }
    const value = this.model();
    const totalAmount = v2ParseAmount(value.total)!;
    const currency = value.currency as V2ProjectCurrency;
    this.saving.set(true);
    this.error.set('');
    try {
      const chosen = this.file();
      const fileId = chosen
        ? await this.projects.uploadFile(this.project.id, 'contract', chosen)
        : undefined;
      const contract = this.data.contract;
      const project = contract
        ? await this.projects.updateContract(this.project.id, contract.id, {
            ...(value.number.trim() !== contract.number && { number: value.number.trim() }),
            ...(value.signedOn !== contract.signedOn && { signedOn: value.signedOn }),
            ...(totalAmount !== contract.total.amount && { totalAmount }),
            ...(currency !== contract.total.currency && { currency }),
            ...(fileId && { fileId }),
          })
        : await this.projects.addContract(
            this.project.id,
            {
              kind: this.data.kind,
              number: value.number.trim(),
              signedOn: value.signedOn,
              totalAmount,
              currency,
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
