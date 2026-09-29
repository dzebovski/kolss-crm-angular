import type { LocaleCode } from '@domain/i18n.types';
import type { V2Money, V2ProjectCurrency } from './project.types';

const NBSP = '\u00a0';
const SYMBOL: Record<V2ProjectCurrency, string> = { PLN: 'zł', USD: '$', EUR: '€', UAH: '₴' };

/** Currencies offered by Add contract, in the board's order (zł, $, €, ₴). */
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
