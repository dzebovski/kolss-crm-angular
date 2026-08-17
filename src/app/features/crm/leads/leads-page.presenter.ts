import { localeToBcp47 } from '@core/i18n/locale-storage';
import type { LocaleCode } from '@domain/i18n.types';

/** Short `24 лип` style date used across the leads table. */
export function formatLeadDayMonth(value: string, locale: LocaleCode): string {
  return new Intl.DateTimeFormat(localeToBcp47(locale), {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

export function formatLeadTime(value: string, locale: LocaleCode): string {
  return new Intl.DateTimeFormat(localeToBcp47(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
