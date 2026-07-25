import type { MessageKey } from '@core/i18n/messages';
import type { LocaleCode } from '@domain/i18n.types';
import type { ContractCurrency } from '@domain/lead.types';
import type { OfficeId } from '@domain/office.types';

/** Which national phone-number layout an office's numbers are formatted with. */
export type PhoneFormat = 'ua' | 'pl';

/**
 * Single source of truth for everything the app hardcodes per physical office.
 * Adding a third office means adding one entry here (the compiler enforces a
 * full `Record<OfficeId, OfficeConfig>`); the office *list* itself still comes
 * from `/v1/me` at runtime.
 */
export interface OfficeConfig {
  readonly id: OfficeId;
  /** i18n key for the office's display name (`messages.ts`). */
  readonly nameKey: MessageKey;
  readonly phoneFormat: PhoneFormat;
  readonly currency: ContractCurrency;
  readonly timeZone: string;
  readonly defaultLocale: LocaleCode;
  /** Stable display/priority order across office pickers and filters. */
  readonly sortOrder: number;
}

export const OFFICE_CONFIG: Record<OfficeId, OfficeConfig> = {
  kyiv: {
    id: 'kyiv',
    nameKey: 'office.kyiv',
    phoneFormat: 'ua',
    currency: 'UAH',
    timeZone: 'Europe/Kyiv',
    defaultLocale: 'uk',
    sortOrder: 0,
  },
  warsaw: {
    id: 'warsaw',
    nameKey: 'office.warsaw',
    phoneFormat: 'pl',
    currency: 'PLN',
    timeZone: 'Europe/Warsaw',
    defaultLocale: 'pl',
    sortOrder: 1,
  },
};

export const OFFICE_IDS: readonly OfficeId[] = (Object.keys(OFFICE_CONFIG) as OfficeId[]).sort(
  (a, b) => OFFICE_CONFIG[a].sortOrder - OFFICE_CONFIG[b].sortOrder,
);

export function isOfficeId(value: string | null | undefined): value is OfficeId {
  return value != null && Object.hasOwn(OFFICE_CONFIG, value);
}

/** Falls back to Kyiv's time zone for unknown/missing codes, matching prior ad-hoc fallbacks. */
export function officeTimeZone(code: string | null | undefined): string {
  return isOfficeId(code) ? OFFICE_CONFIG[code].timeZone : OFFICE_CONFIG.kyiv.timeZone;
}
