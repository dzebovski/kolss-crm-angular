import type { LocaleCode } from '@domain/i18n.types';

/** Plural forms v2 messages provide: `<key>.one|few|many|other` in every locale. */
export type V2PluralCategory = 'one' | 'few' | 'many' | 'other';

const RULES = new Map<LocaleCode, Intl.PluralRules>();

/** CLDR plural category for `count` (uk/pl use one/few/many, en one/other). */
export function v2PluralCategory(locale: LocaleCode, count: number): V2PluralCategory {
  let rules = RULES.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    RULES.set(locale, rules);
  }
  const category = rules.select(count);
  return category === 'one' || category === 'few' || category === 'many' ? category : 'other';
}
