import type { V2ProjectPaymentBasis } from './project.types';

/**
 * Pure rules of the project popups: amount parsing, payment bases and the date checks. The API checks the same limits; these only keep the popup from sending
 * something it would refuse.
 */

/**
 * "12 000,50" / "12000.5" → 12000.5. Null for an empty, non-positive or malformed amount and for
 * more than two decimals (the API stores cents).
 */
export function v2ParseAmount(text: string): number | null {
  const compact = text.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(compact)) return null;
  const value = Number(compact);
  return value > 0 ? value : null;
}

/** 12000.5 → "12 000,50" style text for an input, in the viewer's locale grouping. */
export function v2AmountText(amount: number, locale: string): string {
  // No grouping: "1,000" in English would read back as a decimal in `v2ParseAmount`.
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** What a payment is recorded against, in the order of Add payment. */
export const V2_PAYMENT_BASES: readonly V2ProjectPaymentBasis[] = [
  'receipt',
  'invoice',
  'contract',
  'other',
];

/** A `YYYY-MM-DD` day after `today` (signing and payment dates cannot be in the future). */
export function v2IsFutureDay(day: string, today: string): boolean {
  return day > today;
}

/** A `YYYY-MM-DD` day before `today` (an event date must not be in the past). */
export function v2IsPastDay(day: string, today: string): boolean {
  return day < today;
}

/** The viewer's local day as `YYYY-MM-DD`. */
export function v2LocalDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
