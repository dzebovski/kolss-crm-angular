import { v2AmountText, v2ParseAmount } from './project-forms';
import type { V2Money, V2ProjectCurrency } from './project.types';

/**
 * The preliminary estimate as one total (pipeline 4, API 2.43.0). The form holds text so the
 * person can type freely; an emptied amount clears a stored estimate.
 */
export interface V2EstimateForm {
  amount: string;
  currency: string;
}

export type V2EstimateError = 'amountInvalid';

/** What `PUT /v1/projects/{id}/estimate` takes: `amount: null` clears the estimate. */
export interface V2EstimateInput {
  readonly amount: number | null;
  readonly currency?: V2ProjectCurrency;
}

/** The stored estimate as form text; an empty one takes `fallback` as its currency. */
export function v2EstimateFormInitial(
  estimate: V2Money | null,
  fallback: V2ProjectCurrency,
  locale: string,
): V2EstimateForm {
  return {
    amount: estimate ? v2AmountText(estimate.amount, locale) : '',
    currency: estimate?.currency ?? fallback,
  };
}

/** The amount is optional; when given it must parse. */
export function v2EstimateFormError(form: V2EstimateForm): V2EstimateError | null {
  const amount = form.amount.trim();
  return amount && v2ParseAmount(amount) === null ? 'amountInvalid' : null;
}

/**
 * The request for a changed form, or null when nothing changed (also for an empty form of a
 * project without an estimate). `stored` is null for a project without one (or not yet created).
 */
export function v2EstimateFormChange(
  form: V2EstimateForm,
  initial: V2EstimateForm,
  stored: V2Money | null,
): V2EstimateInput | null {
  if (form.amount.trim() === initial.amount.trim() && form.currency === initial.currency) {
    return null;
  }
  const amount = v2ParseAmount(form.amount);
  if (amount === null) return stored ? { amount: null } : null;
  return { amount, currency: form.currency as V2ProjectCurrency };
}
