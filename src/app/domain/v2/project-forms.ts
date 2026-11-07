import type { V2Money, V2ProjectContract, V2ProjectCurrency } from './project.types';

/**
 * Pure rules of the project popups (P5): amount parsing, the quick amounts of Add payment and
 * the date checks. The API checks the same limits; these only keep the popup from sending
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

export type V2QuickAmountKind = 'remaining' | 'fixed' | 'percent10' | 'to50';

export interface V2QuickAmount {
  readonly kind: V2QuickAmountKind;
  readonly amount: number;
}

/** First intro payments the owner named (2026-11-07): 500 or 1000 zł. */
const FIXED_PLN = [500, 1000];

/**
 * Quick amounts of Add payment (pipeline 3): 500 / 1000 zł (PLN only), 10% of the total, the sum
 * that brings the main contract to 50% (credited intro counts) and the remaining balance. Only
 * positive amounts within the remaining balance, each amount once, smallest first.
 */
export function v2PaymentQuickAmounts(
  contract: Pick<
    V2ProjectContract,
    'kind' | 'total' | 'paid' | 'credited' | 'remaining' | 'target50'
  >,
): readonly V2QuickAmount[] {
  const remaining = contract.remaining.amount;
  const candidates: V2QuickAmount[] = [];
  if (contract.total.currency === 'PLN') {
    for (const amount of FIXED_PLN) candidates.push({ kind: 'fixed', amount });
  }
  candidates.push({ kind: 'percent10', amount: cents(contract.total.amount * 0.1) });
  if (contract.kind === 'main' && contract.target50) {
    const covered = contract.paid.amount + contract.credited.amount;
    candidates.push({ kind: 'to50', amount: cents(contract.target50.amount - covered) });
  }
  candidates.push({ kind: 'remaining', amount: remaining });
  const seen = new Set<number>();
  return candidates
    .filter((quick) => quick.amount > 0 && quick.amount <= remaining)
    .sort((a, b) => a.amount - b.amount)
    .filter((quick) => {
      if (seen.has(quick.amount)) return false;
      seen.add(quick.amount);
      return true;
    });
}

/** The most a payment may be: the contract's remaining balance (plus the payment itself when editing). */
export function v2PaymentLimit(
  contract: Pick<V2ProjectContract, 'remaining'>,
  editedAmount = 0,
): number {
  return cents(contract.remaining.amount + editedAmount);
}

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

/** Same currency, amounts summed; used for "paid after this". */
export function v2AddMoney(money: V2Money, amount: number): V2Money {
  return { ...money, amount: cents(money.amount + amount) };
}

/** Currency of a new contract: the office default intro amount's, else PLN. */
export function v2DefaultCurrency(introDefault: V2Money | null): V2ProjectCurrency {
  return introDefault?.currency ?? 'PLN';
}

function cents(value: number): number {
  return Math.round(value * 100) / 100;
}
