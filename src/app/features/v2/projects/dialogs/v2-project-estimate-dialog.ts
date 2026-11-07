import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';

import { I18nService } from '@core/i18n/i18n.service';
import type { MessageKey } from '@core/i18n/messages';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { formatV2Money, V2_ESTIMATE_LINES, V2_PROJECT_CURRENCIES } from '@domain/v2/project-money';
import { v2AmountText, v2DefaultCurrency, v2ParseAmount } from '@domain/v2/project-forms';
import type {
  V2EstimateLineKey,
  V2Money,
  V2Project,
  V2ProjectCurrency,
} from '@domain/v2/project.types';
import { V2ProjectsService } from '@services/v2/v2-projects.service';
import { V2DialogShell } from '../../ui/dialog/v2-dialog-shell';
import { V2FormField } from '../../ui/dialog/v2-form-field';
import { V2Select } from '../../ui/v2-select';
import { V2ProjectNotice } from './v2-project-notice';

export interface V2ProjectEstimateData {
  readonly project: V2Project;
}

interface LineModel {
  amount: string;
  currency: string;
  note: string;
}

type EstimateModel = Record<V2EstimateLineKey, LineModel>;
type LineErrors = Partial<Record<'amount' | 'note', string>>;
type LineInput = { amount: number; currency: V2ProjectCurrency; note?: string | null } | null;

const NOTE_MAX = 300;

// Edit estimate (Project card, pipeline 2.1/3): Kitchen, Appliances, Installation, Countertop,
// each an optional amount + currency + note. An emptied amount removes the line; only changed
// lines are sent. Read-only once the main contract exists (the page never opens it then).
// Closes with the updated project, or null when nothing changed.
@Component({
  selector: 'app-v2-project-estimate-dialog',
  imports: [FormField, TranslatePipe, V2DialogShell, V2FormField, V2ProjectNotice, V2Select],
  templateUrl: './v2-project-estimate-dialog.html',
  styles: `
    .v2-estimate-popup__line {
      display: flex;
      flex-direction: column;
      gap: var(--v2-space-3);
      min-width: 0;
      margin: 0;
      padding: 0 0 var(--v2-space-4);
      border: 0;
      border-bottom: 1px solid var(--v2-line-soft);

      legend {
        padding: 0;
        margin-bottom: var(--v2-space-3);
        font-size: 14px;
        font-weight: 600;
      }
    }

    .v2-estimate-popup__money {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--v2-space-3);
    }

    .v2-estimate-popup__total {
      display: flex;
      justify-content: space-between;
      gap: var(--v2-space-4);
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
  `,
})
export class V2ProjectEstimateDialog {
  private readonly dialogRef = inject<DialogRef<V2Project | null>>(DialogRef);
  private readonly projects = inject(V2ProjectsService);
  private readonly i18n = inject(I18nService);
  private readonly data = inject<V2ProjectEstimateData>(DIALOG_DATA);

  private readonly project = this.data.project;
  protected readonly subtitle = `${this.project.code} · ${this.project.clientName}`;
  protected readonly lineKeys = V2_ESTIMATE_LINES;
  protected readonly currencies = V2_PROJECT_CURRENCIES.map((code) => ({
    value: code,
    label: code,
  }));

  private readonly initial: EstimateModel = (() => {
    const locale = this.i18n.locale();
    const fallback = v2DefaultCurrency(this.project.introDefault);
    const entries = V2_ESTIMATE_LINES.map((key) => {
      const line = this.project.estimate.lines[key];
      return [
        key,
        {
          amount: line ? v2AmountText(line.money.amount, locale) : '',
          currency: line?.money.currency ?? fallback,
          note: line?.note ?? '',
        },
      ] as const;
    });
    return Object.fromEntries(entries) as EstimateModel;
  })();

  protected readonly model = signal<EstimateModel>(structuredClone(this.initial));
  protected readonly fields = form(this.model);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly touched = signal(false);

  private readonly errors = computed(() => {
    const value = this.model();
    const errors: Partial<Record<V2EstimateLineKey, LineErrors>> = {};
    for (const key of V2_ESTIMATE_LINES) {
      const line = value[key];
      const lineErrors: LineErrors = {};
      const amountText = line.amount.trim();
      if (amountText && v2ParseAmount(amountText) === null)
        lineErrors.amount = this.i18n.t('v2.projectPopup.amountMissing');
      if (!amountText && line.note.trim())
        lineErrors.amount = this.i18n.t('v2.projectPopup.estimate.noteWithoutAmount');
      if (line.note.trim().length > NOTE_MAX)
        lineErrors.note = this.i18n.t('v2.projectCard.commentTooLong', { max: NOTE_MAX });
      if (Object.keys(lineErrors).length) errors[key] = lineErrors;
    }
    return errors;
  });

  protected readonly errorCount = computed(() =>
    Object.values(this.errors()).reduce((count, line) => count + Object.keys(line!).length, 0),
  );
  protected readonly invalid = computed(() => this.errorCount() > 0);
  protected readonly shown = computed(() => (this.touched() ? this.errors() : {}));

  /** Changed lines only: a line object replaces, null removes. */
  private readonly changes = computed(() => {
    const changes: Partial<Record<V2EstimateLineKey, LineInput>> = {};
    const value = this.model();
    for (const key of V2_ESTIMATE_LINES) {
      const next = value[key];
      const before = this.initial[key];
      if (JSON.stringify(next) === JSON.stringify(before)) continue;
      const amount = v2ParseAmount(next.amount);
      const stored = this.project.estimate.lines[key];
      if (amount === null) {
        if (stored) changes[key] = null;
        continue;
      }
      changes[key] = {
        amount,
        currency: next.currency as V2ProjectCurrency,
        note: next.note.trim() || null,
      };
    }
    return changes;
  });

  protected readonly hasUnsavedInput = computed(() => Object.keys(this.changes()).length > 0);
  protected readonly hint = computed(() => this.i18n.t('v2.projectPopup.timelineHint'));

  /** Live total per currency, like the card. */
  protected readonly total = computed(() => {
    const sums = new Map<V2ProjectCurrency, number>();
    for (const key of V2_ESTIMATE_LINES) {
      const line = this.model()[key];
      const amount = v2ParseAmount(line.amount);
      if (amount === null) continue;
      const currency = line.currency as V2ProjectCurrency;
      sums.set(currency, Math.round(((sums.get(currency) ?? 0) + amount) * 100) / 100);
    }
    const locale = this.i18n.locale();
    return [...sums]
      .map(([currency, amount]): V2Money => ({ amount, currency }))
      .map((money) => formatV2Money(money, locale))
      .join(' + ');
  });

  protected labelKey(key: V2EstimateLineKey): MessageKey {
    return `v2.project.estimate.${key}` as MessageKey;
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.invalid()) return;
    const lines = this.changes();
    if (!Object.keys(lines).length) {
      this.dialogRef.close(null);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      this.dialogRef.close(await this.projects.updateEstimate(this.project.id, { lines }));
    } catch (error) {
      this.error.set(
        this.i18n.localizeError(error instanceof Error ? error.message : 'error.actionFailed'),
      );
    } finally {
      this.saving.set(false);
    }
  }
}
