import type { ContractCurrency } from '@domain/lead.types';

/**
 * Live budget mask for the G3 popup controls (Popup-rules.dc.html "Masks and formats" +
 * Create-lead.dc.html script `fmtMoney`/`fmtBudget`/validate `budget`): "Budget: one input for
 * an amount or a range (45 000 or 40 000 – 50 000); spaces and the dash are formatted as you
 * type." The typed text is always digits-only per group (the mask itself rejects anything
 * else), so the only *content* error left is the range order.
 *
 * `isV2BudgetText` (`./lead-action.ts`) already validates the saved string against the API
 * contract and matches `kolss-platform-api/internal/crmapi/v2_status.go` `parseBudgetText` /
 * `parseBudgetNumber` (spaces, NBSP, narrow NBSP and `,` as a decimal separator, upper ≥
 * lower). This module only adds the as-you-type formatter and the single extra UI message
 * Popup-rules draws ("The second number should be bigger…") — it does not duplicate that
 * validation.
 */

/** Digits-only, leading zeros stripped, capped at 9 digits, grouped by thousands with a space. */
export function v2FormatMoneyInput(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Splits `"40 000 – 50 000"` into `[40000, 50000]`; a missing/unparsable side is `0`. */
export function v2BudgetParts(value: string): readonly [number, number | null] {
  const parts = (value ?? '').split(/\s*[-–—]\s*/);
  const lower = Number((parts[0] ?? '').replace(/\D/g, '')) || 0;
  if (parts.length < 2) return [lower, null];
  const upper = Number((parts[1] ?? '').replace(/\D/g, '')) || 0;
  return [lower, upper];
}

/**
 * Formats the budget field as the person types (`fmtBudget`): each side is grouped by
 * `v2FormatMoneyInput`, and backspacing over the auto-inserted `" – "` removes the dash
 * instead of leaving a dangling separator.
 */
export function v2FormatBudgetInput(raw: string, previous: string): string {
  const text = raw ?? '';
  const parts = text.split(/\s*[-–—]\s*/);
  const lower = v2FormatMoneyInput(parts[0] ?? '');
  if (parts.length < 2) return lower;

  const upperRaw = parts.slice(1).join('');
  const backspacedOverDash =
    !!previous && text.length < previous.length && / – $/.test(previous) && !/\d/.test(upperRaw);
  if (backspacedOverDash) return lower;
  if (!lower) return '';
  return `${lower} – ${v2FormatMoneyInput(upperRaw)}`;
}

/** Popup-rules "range order" rule: a two-sided value where the upper bound is below the lower. */
export function v2BudgetRangeOrderInvalid(value: string): boolean {
  const [lower, upper] = v2BudgetParts(value);
  return upper !== null && lower > 0 && upper > 0 && upper < lower;
}

/** Display symbol for a budget currency (Create-lead.dc.html `CURRENCIES`). */
export const V2_BUDGET_CURRENCY_SYMBOL: Record<ContractCurrency, string> = {
  PLN: 'zł',
  USD: '$',
  EUR: '€',
  UAH: '₴',
};

export interface V2BudgetPreset {
  /** Formatted range shown on the chip and written to the field when picked. */
  readonly text: string;
  readonly low: number;
  readonly high: number;
}

/** Create-lead.dc.html `PRESETS`: 4 quick ranges per currency, formatted like the typed value. */
const PRESET_BOUNDS: Record<ContractCurrency, readonly (readonly [number, number])[]> = {
  PLN: [
    [20_000, 40_000],
    [40_000, 60_000],
    [60_000, 80_000],
    [80_000, 120_000],
  ],
  USD: [
    [5_000, 10_000],
    [10_000, 15_000],
    [15_000, 20_000],
    [20_000, 30_000],
  ],
  EUR: [
    [5_000, 10_000],
    [10_000, 15_000],
    [15_000, 20_000],
    [20_000, 30_000],
  ],
  UAH: [
    [200_000, 400_000],
    [400_000, 600_000],
    [600_000, 800_000],
    [800_000, 1_200_000],
  ],
};

export function v2BudgetPresets(currency: ContractCurrency): readonly V2BudgetPreset[] {
  return PRESET_BOUNDS[currency].map(([low, high]) => ({
    text: `${v2FormatMoneyInput(String(low))} – ${v2FormatMoneyInput(String(high))}`,
    low,
    high,
  }));
}
