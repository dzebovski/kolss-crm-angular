import type { LocaleCode } from '@domain/i18n.types';
import type { V2Money, V2ProjectCurrency, V2ProjectPayment } from './project.types';

const NBSP = '\u00a0';
const SYMBOL: Record<V2ProjectCurrency, string> = { PLN: 'zł', USD: '$', EUR: '€', UAH: '₴' };

/** Currencies offered by the money fields, in the board's order (zł, $, €, ₴). */
export const V2_PROJECT_CURRENCIES: readonly V2ProjectCurrency[] = ['PLN', 'USD', 'EUR', 'UAH'];

export function v2CurrencySymbol(currency: V2ProjectCurrency): string {
  return SYMBOL[currency];
}

/** Whole percent of `total` covered by `part`, clamped to 0–100; 0 when there is no total. */
export function v2PercentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
}

/** `40 000 zł` (thousands separated by a non-breaking space; decimals only when there are any). */
export function formatV2Money(money: V2Money, locale: LocaleCode): string {
  const cents = Math.round(Math.abs(money.amount) * 100);
  const whole = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const fraction = cents % 100;
  const decimal = locale === 'en' ? '.' : ',';
  const digits = fraction === 0 ? whole : `${whole}${decimal}${String(fraction).padStart(2, '0')}`;
  return `${money.amount < 0 ? '-' : ''}${digits}${NBSP}${SYMBOL[money.currency]}`;
}

/** Estimate minus the payments in the estimate's currency; a negative `remaining` is an overpayment. */
export interface V2ProjectBalance {
  readonly paid: V2Money;
  readonly remaining: V2Money;
  /** Some payments are in another currency and are not counted. */
  readonly otherCurrencies: boolean;
}

/** Null without an estimate: there is nothing to pay off. */
export function v2ProjectBalance(
  estimate: V2Money | null,
  paidTotals: readonly V2Money[],
): V2ProjectBalance | null {
  if (!estimate) return null;
  const paid = paidTotals.find((money) => money.currency === estimate.currency)?.amount ?? 0;
  const cents = Math.round(estimate.amount * 100) - Math.round(paid * 100);
  return {
    paid: { amount: paid, currency: estimate.currency },
    remaining: { amount: cents / 100, currency: estimate.currency },
    otherCurrencies: paidTotals.some(
      (money) => money.currency !== estimate.currency && money.amount !== 0,
    ),
  };
}

/** Payments page order: latest payment day first, then the latest entry. */
export function v2PaymentsNewestFirst(
  payments: readonly V2ProjectPayment[],
): readonly V2ProjectPayment[] {
  return [...payments].sort(
    (a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt),
  );
}
