import type { LocaleCode } from '../../services/crm-mock.types';
import { localeToBcp47 } from './locale-storage';

export function formatDateForLocale(value: string | null | undefined, locale: LocaleCode): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(localeToBcp47(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatShortDateForLocale(
  value: string | null | undefined,
  locale: LocaleCode,
): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(localeToBcp47(locale), {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function formatDateTimeForLocale(
  value: string | null | undefined,
  locale: LocaleCode,
): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(localeToBcp47(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatMoneyForLocale(
  value: number | null | undefined,
  locale: LocaleCode,
  currency = 'EUR',
): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(localeToBcp47(locale), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMonthYearForLocale(year: number, month: number, locale: LocaleCode): string {
  const label = new Intl.DateTimeFormat(localeToBcp47(locale), { month: 'long' }).format(
    new Date(year, month - 1, 1),
  );
  return `${label} ${year}`;
}

export function compareForLocale(left: string, right: string, locale: LocaleCode): number {
  return left.localeCompare(right, localeToBcp47(locale));
}
