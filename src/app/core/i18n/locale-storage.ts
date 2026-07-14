import type { LocaleCode } from '../../services/crm-mock.types';

const STORAGE_KEY = 'kolss.locale';

let activeLocale: LocaleCode = readStoredLocale() ?? 'en';

export function readStoredLocale(): LocaleCode | null {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return null;
    }
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'uk' || value === 'pl' || value === 'en') return value;
    return null;
  } catch {
    return null;
  }
}

export function getActiveLocale(): LocaleCode {
  return activeLocale;
}

export function setActiveLocale(locale: LocaleCode): void {
  activeLocale = locale;
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
  } catch {
    // ignore storage failures in tests or private mode
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

export function localeToBcp47(locale: LocaleCode): string {
  switch (locale) {
    case 'pl':
      return 'pl-PL';
    case 'en':
      return 'en-GB';
    default:
      return 'uk-UA';
  }
}
