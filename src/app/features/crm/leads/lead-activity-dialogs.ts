import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { I18nService } from '../../../core/i18n/i18n.service';
import type { ContractCurrency } from '../../../services/crm-mock.types';
import { UiButton } from '../../../ui/button/ui-button';
import { UiSelect, type UiSelectOption } from '../../../ui/form/ui-select';
import { UiTextField } from '../../../ui/form/ui-text-field';
import { UiTextarea } from '../../../ui/form/ui-textarea';

const DIALOG_STYLES = `
  :host { display: block; }
  .activity-dialog { width: min(31rem, calc(100vw - 2rem)); padding: 1.5rem; display: grid; gap: 1.25rem; }
  .activity-dialog__heading { display: grid; gap: .35rem; }
  .activity-dialog__heading small { color: var(--ui-action); font-size: .7rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .activity-dialog h2, .activity-dialog p { margin: 0; }
  .activity-dialog h2 { font-family: var(--ui-font-display), sans-serif; font-size: 1.55rem; }
  .activity-dialog p { color: var(--ui-text-muted); font-size: .875rem; }
  .activity-dialog__actions { display: flex; justify-content: flex-end; gap: .75rem; }
  .reason-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
  .reason-selector button { min-height: 2.75rem; padding: .5rem; border: 1px solid var(--ui-border-strong); border-radius: var(--ui-radius-md); background: var(--ui-surface-raised); color: var(--ui-text); cursor: pointer; font-weight: 700; }
  .reason-selector button[aria-checked='true'] { border-color: var(--ui-action); background: color-mix(in srgb, var(--ui-action) 10%, white); color: var(--ui-action); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-action) 14%, transparent); }
  .contract-grid { display: grid; grid-template-columns: 1fr 9rem; gap: .75rem; }
  @media (max-width: 34rem) { .reason-selector, .contract-grid { grid-template-columns: 1fr; } }
`;

export interface TextActivityDialogData {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly commentOptional?: boolean;
  readonly initialValue?: string;
  readonly allowDueDate?: boolean;
}

export interface TextActivityDialogResult {
  readonly comment: string;
  readonly dueDate?: string;
}

@Component({
  selector: 'app-text-activity-dialog',
  imports: [FormField, UiButton, UiTextarea, UiTextField],
  template: `
    <form class="activity-dialog" (submit)="save(); $event.preventDefault()">
      <header class="activity-dialog__heading">
        <small>{{ data.eyebrow }}</small>
        <h2 id="text-activity-title">{{ data.title }}</h2>
        <p>{{ data.description }}</p>
      </header>
      <app-ui-textarea
        [label]="i18n.t('lead.comment')"
        [placeholder]="data.placeholder"
        [rows]="4"
        [formField]="commentForm.comment"
        [error]="commentError()"
      />
      @if (data.allowDueDate) {
        <app-ui-text-field
          type="date"
          [label]="i18n.t('activity.dueDateLabel')"
          [formField]="commentForm.dueDate"
        />
      }
      <footer class="activity-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="cancel()">{{
          i18n.t('common.cancel')
        }}</app-ui-button>
        <app-ui-button type="submit" [disabled]="commentForm().invalid()">
          {{ data.submitLabel }}
        </app-ui-button>
      </footer>
    </form>
  `,
  styles: [DIALOG_STYLES],
})
export class TextActivityDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<TextActivityDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TextActivityDialog, TextActivityDialogResult>);
  protected readonly model = signal({
    comment: this.data.initialValue ?? '',
    dueDate: '',
  });
  protected readonly commentForm = form(this.model, (path) => {
    if (this.data.commentOptional) return;
    required(path.comment, { message: this.i18n.t('activity.commentRequired') });
    validate(path.comment, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'whitespace', message: this.i18n.t('activity.commentRequired') },
    );
  });

  protected commentError(): string {
    const state = this.commentForm.comment();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected save(): void {
    submit(this.commentForm, async () => {
      const comment = this.model().comment.trim();
      const dueDate = this.data.allowDueDate ? this.model().dueDate.trim() : '';
      this.dialogRef.close({
        comment,
        ...(dueDate ? { dueDate } : {}),
      });
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}

export interface DueDateDialogData {
  readonly statusLabel: string;
}

@Component({
  selector: 'app-due-date-dialog',
  imports: [FormField, UiButton, UiTextField],
  template: `
    <form class="activity-dialog" (submit)="save(); $event.preventDefault()">
      <header class="activity-dialog__heading">
        <small>{{ data.statusLabel }}</small>
        <h2 id="due-date-title">{{ i18n.t('activity.dueDateTitle') }}</h2>
        <p>{{ i18n.t('activity.dueDateDescription') }}</p>
      </header>
      <app-ui-text-field
        type="date"
        [label]="i18n.t('activity.dueDateLabel')"
        [formField]="dueDateForm.date"
        [error]="dateError()"
      />
      <footer class="activity-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="cancel()">
          {{ i18n.t('common.cancel') }}
        </app-ui-button>
        <app-ui-button type="submit" [disabled]="dueDateForm().invalid()">
          {{ i18n.t('common.save') }}
        </app-ui-button>
      </footer>
    </form>
  `,
  styles: [DIALOG_STYLES],
})
export class DueDateDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<DueDateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DueDateDialog, string>);
  protected readonly model = signal({ date: '' });
  protected readonly dueDateForm = form(this.model, (path) => {
    required(path.date, { message: this.i18n.t('activity.dueDateRequired') });
  });

  protected dateError(): string {
    const state = this.dueDateForm.date();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected save(): void {
    submit(this.dueDateForm, async () => this.dialogRef.close(this.model().date));
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}

export interface CloseStatusResult {
  readonly reason: 'expensive' | 'invalid' | 'other';
  readonly comment: string;
}

@Component({
  selector: 'app-close-status-dialog',
  imports: [FormField, UiButton, UiTextarea],
  template: `
    <form class="activity-dialog" (submit)="save(); $event.preventDefault()">
      <header class="activity-dialog__heading">
        <small>{{ i18n.t('activity.finalStatus') }}</small>
        <h2 id="close-status-title">{{ i18n.t('activity.closeTitle') }}</h2>
        <p>{{ i18n.t('activity.closeDescription') }}</p>
      </header>
      <div
        class="reason-selector"
        role="radiogroup"
        [attr.aria-label]="i18n.t('activity.closeReasonAria')"
      >
        @for (reason of reasons; track reason.value) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="model().reason === reason.value"
            (click)="selectReason(reason.value)"
          >
            {{ reason.label }}
          </button>
        }
      </div>
      <app-ui-textarea
        [label]="i18n.t('lead.comment')"
        [placeholder]="i18n.t('activity.closePlaceholder')"
        [rows]="4"
        [formField]="closeForm.comment"
        [error]="commentError()"
      />
      <footer class="activity-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="cancel()">{{
          i18n.t('common.cancel')
        }}</app-ui-button>
        <app-ui-button type="submit" variant="danger" [disabled]="closeForm().invalid()">
          {{ i18n.t('activity.closeSubmit') }}
        </app-ui-button>
      </footer>
    </form>
  `,
  styles: [DIALOG_STYLES],
})
export class CloseStatusDialog {
  protected readonly i18n = inject(I18nService);
  private readonly dialogRef = inject(MatDialogRef<CloseStatusDialog, CloseStatusResult>);
  protected readonly reasons = [
    { value: 'expensive' as const, label: this.i18n.closeReasonLabel('expensive') },
    { value: 'invalid' as const, label: this.i18n.closeReasonLabel('invalid') },
    { value: 'other' as const, label: this.i18n.closeReasonLabel('other') },
  ];
  protected readonly model = signal<CloseStatusResult>({ reason: 'expensive', comment: '' });
  protected readonly closeForm = form(this.model, (path) => {
    required(path.comment, { message: this.i18n.t('activity.commentRequired') });
    validate(path.comment, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'whitespace', message: this.i18n.t('activity.commentRequired') },
    );
  });

  protected selectReason(reason: CloseStatusResult['reason']): void {
    this.model.update((value) => ({ ...value, reason }));
  }

  protected commentError(): string {
    const state = this.closeForm.comment();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected save(): void {
    submit(this.closeForm, async () =>
      this.dialogRef.close({ ...this.model(), comment: this.model().comment.trim() }),
    );
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}

export interface ContractStatusDialogData {
  readonly defaultCurrency: ContractCurrency;
}

export interface ContractStatusResult {
  readonly contractNumber: string;
  readonly amount: number;
  readonly currency: ContractCurrency;
}

@Component({
  selector: 'app-contract-status-dialog',
  imports: [FormField, UiButton, UiSelect, UiTextField],
  template: `
    <form class="activity-dialog" (submit)="save(); $event.preventDefault()">
      <header class="activity-dialog__heading">
        <small>{{ i18n.t('activity.success') }}</small>
        <h2 id="contract-status-title">{{ i18n.t('activity.contractTitle') }}</h2>
        <p>{{ i18n.t('activity.contractDescription') }}</p>
      </header>
      <app-ui-text-field
        [label]="i18n.t('activity.contractNumber')"
        [placeholder]="i18n.t('activity.contractNumberPlaceholder')"
        [formField]="contractForm.contractNumber"
        [error]="fieldError('contractNumber')"
      />
      <div class="contract-grid">
        <app-ui-text-field
          [label]="i18n.t('activity.amount')"
          placeholder="0.00"
          [formField]="contractForm.amount"
          [error]="fieldError('amount')"
        />
        <app-ui-select
          [label]="i18n.t('activity.currency')"
          [options]="currencyOptions"
          [formField]="contractForm.currency"
        />
      </div>
      <footer class="activity-dialog__actions">
        <app-ui-button variant="ghost" (pressed)="cancel()">{{
          i18n.t('common.cancel')
        }}</app-ui-button>
        <app-ui-button type="submit" [disabled]="contractForm().invalid()">
          {{ i18n.t('activity.successSubmit') }}
        </app-ui-button>
      </footer>
    </form>
  `,
  styles: [DIALOG_STYLES],
})
export class ContractStatusDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<ContractStatusDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ContractStatusDialog, ContractStatusResult>);
  protected readonly currencyOptions: readonly UiSelectOption[] = ['UAH', 'USD', 'EUR', 'PLN'].map(
    (value) => ({ value, label: value }),
  );
  protected readonly model = signal({
    contractNumber: '',
    amount: '',
    currency: this.data.defaultCurrency,
  });
  protected readonly contractForm = form(this.model, (path) => {
    required(path.contractNumber, { message: this.i18n.t('activity.contractNumberRequired') });
    required(path.amount, { message: this.i18n.t('activity.amountRequired') });
    validate(path.contractNumber, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'whitespace', message: this.i18n.t('activity.contractNumberRequired') },
    );
    validate(path.amount, ({ value }) => {
      const amount = Number(value().replace(',', '.'));
      return Number.isFinite(amount) && amount > 0
        ? undefined
        : { kind: 'amount', message: this.i18n.t('activity.amountPositive') };
    });
  });

  protected fieldError(field: 'contractNumber' | 'amount'): string {
    const state = this.contractForm[field]();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected save(): void {
    submit(this.contractForm, async () => {
      const value = this.model();
      this.dialogRef.close({
        contractNumber: value.contractNumber.trim(),
        amount: Number(value.amount.replace(',', '.')),
        currency: value.currency,
      });
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
