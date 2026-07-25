import type { LocaleCode } from '@domain/i18n.types';
import type { MessageKey } from './messages.uk';

export type { MessageKey };

export type MessageParams = Record<string, string | number>;

/** One locale's complete translation table. Every `MessageKey` is guaranteed present. */
export type MessageBundle = Record<MessageKey, string>;

export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return Object.entries(params).reduce<string>(
    (text, [param, value]) => text.replaceAll(`{${param}}`, String(value)),
    template,
  );
}

/**
 * Loads exactly one locale's message bundle via a dynamic `import()`, so each
 * locale ships as its own lazy chunk instead of all three loading eagerly.
 * Used by `I18nService` (active locale only, resolved before first render)
 * and by anything else that needs a specific locale's full bundle
 * synchronously once loaded (see `event-presenter.ts`).
 */
export async function loadMessageBundle(locale: LocaleCode): Promise<MessageBundle> {
  switch (locale) {
    case 'pl':
      return (await import('./messages.pl')).messagesPl;
    case 'en':
      return (await import('./messages.en')).messagesEn;
    case 'uk':
    default:
      return (await import('./messages.uk')).messagesUk;
  }
}
