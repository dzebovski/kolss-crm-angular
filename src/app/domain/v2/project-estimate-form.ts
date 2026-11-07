import { V2_ESTIMATE_LINES } from './project-money';
import { v2AmountText, v2ParseAmount } from './project-forms';
import type {
  V2EstimateLineKey,
  V2Money,
  V2ProjectCurrency,
  V2ProjectEstimate,
} from './project.types';

/** One estimate line as the form holds it (text amount, so the person can type freely). */
export interface V2EstimateLineForm {
  amount: string;
  currency: string;
  note: string;
}

export type V2EstimateForm = Record<V2EstimateLineKey, V2EstimateLineForm>;

export type V2EstimateLineError = 'amountInvalid' | 'noteWithoutAmount' | 'noteTooLong';

export interface V2EstimateLineErrors {
  readonly amount?: V2EstimateLineError;
  readonly note?: V2EstimateLineError;
}

/** What `PATCH /v1/projects/{id}/estimate` takes: a line replaces, null removes. */
export type V2EstimateLineInput = {
  amount: number;
  currency: V2ProjectCurrency;
  note: string | null;
} | null;

export const V2_ESTIMATE_NOTE_MAX = 300;

/** The stored estimate as form text; empty lines take `fallback` as their currency. */
export function v2EstimateFormInitial(
  estimate: V2ProjectEstimate | null,
  fallback: V2ProjectCurrency,
  locale: string,
): V2EstimateForm {
  const entries = V2_ESTIMATE_LINES.map((key) => {
    const line = estimate?.lines[key] ?? null;
    const value: V2EstimateLineForm = {
      amount: line ? v2AmountText(line.money.amount, locale) : '',
      currency: line?.money.currency ?? fallback,
      note: line?.note ?? '',
    };
    return [key, value] as const;
  });
  return Object.fromEntries(entries) as V2EstimateForm;
}

/** Every line is optional; a note needs an amount, an amount must parse. */
export function v2EstimateFormErrors(
  form: V2EstimateForm,
): Partial<Record<V2EstimateLineKey, V2EstimateLineErrors>> {
  const errors: Partial<Record<V2EstimateLineKey, V2EstimateLineErrors>> = {};
  for (const key of V2_ESTIMATE_LINES) {
    const line = form[key];
    const amount = line.amount.trim();
    const note = line.note.trim();
    const lineErrors: { amount?: V2EstimateLineError; note?: V2EstimateLineError } = {};
    if (amount && v2ParseAmount(amount) === null) lineErrors.amount = 'amountInvalid';
    else if (!amount && note) lineErrors.amount = 'noteWithoutAmount';
    if (note.length > V2_ESTIMATE_NOTE_MAX) lineErrors.note = 'noteTooLong';
    if (lineErrors.amount || lineErrors.note) errors[key] = lineErrors;
  }
  return errors;
}

export function v2EstimateErrorCount(
  errors: Partial<Record<V2EstimateLineKey, V2EstimateLineErrors>>,
): number {
  return Object.values(errors).reduce(
    (count, line) => count + (line?.amount ? 1 : 0) + (line?.note ? 1 : 0),
    0,
  );
}

/**
 * Changed lines only. An emptied amount removes a stored line; an untouched or still empty line
 * is left out. `stored` is null for a project that does not exist yet (Create project).
 */
export function v2EstimateFormChanges(
  form: V2EstimateForm,
  initial: V2EstimateForm,
  stored: V2ProjectEstimate | null,
): Partial<Record<V2EstimateLineKey, V2EstimateLineInput>> {
  const changes: Partial<Record<V2EstimateLineKey, V2EstimateLineInput>> = {};
  for (const key of V2_ESTIMATE_LINES) {
    const next = form[key];
    const before = initial[key];
    if (
      next.amount.trim() === before.amount.trim() &&
      next.currency === before.currency &&
      next.note.trim() === before.note.trim()
    ) {
      continue;
    }
    const amount = v2ParseAmount(next.amount);
    if (amount === null) {
      if (stored?.lines[key]) changes[key] = null;
      continue;
    }
    changes[key] = {
      amount,
      currency: next.currency as V2ProjectCurrency,
      note: next.note.trim() || null,
    };
  }
  return changes;
}

/** Live total per currency, in the order the currencies first appear. */
export function v2EstimateFormTotals(form: V2EstimateForm): V2Money[] {
  const sums = new Map<V2ProjectCurrency, number>();
  for (const key of V2_ESTIMATE_LINES) {
    const amount = v2ParseAmount(form[key].amount);
    if (amount === null) continue;
    const currency = form[key].currency as V2ProjectCurrency;
    sums.set(currency, Math.round(((sums.get(currency) ?? 0) + amount) * 100) / 100);
  }
  return [...sums].map(([currency, amount]) => ({ amount, currency }));
}
