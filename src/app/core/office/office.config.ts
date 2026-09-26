import type { MessageKey } from '@core/i18n/messages';
import type { LocaleCode } from '@domain/i18n.types';
import type { ContractCurrency } from '@domain/lead.types';
import type { OfficeId } from '@domain/office.types';
import type { V2PhoneCountryCode } from '@domain/v2/phone-mask';

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
  /** Decorative national marker used in compact office pickers. */
  readonly flagEmoji: string;
  readonly phoneFormat: PhoneFormat;
  readonly currency: ContractCurrency;
  readonly timeZone: string;
  readonly defaultLocale: LocaleCode;
  /** First letter of the office's lead codes (`leads.reference_id`, shown uppercase: K0418, W0231). */
  readonly referencePrefix: string;
  /** Stable display/priority order across office pickers and filters. */
  readonly sortOrder: number;
  /**
   * G3 popup phone mask country code (Popup-rules.dc.html "Masks and formats", Create-lead.dc.html
   * `SHOWROOMS[].cc`). Distinct from `phoneFormat` above, which drives the v1-compatible
   * `@core/phone` display format (`+38 0XX…`), not the new masked input's grouping
   * (`+380 67 214 58 03`).
   */
  readonly phoneCountryCode: V2PhoneCountryCode;
  /** `<app-v2-phone-input>` placeholder (Create-lead.dc.html `phonePh`), a real sample number. */
  readonly phonePlaceholder: string;
  /**
   * Default currency for the G3 budget popup control (Create-lead.dc.html `CURRENCIES` +
   * `initF().currency`). Deliberately not the same as `currency` above (Kyiv budgets are
   * quoted in USD on the board, not UAH) — that field is the office's contract currency, this
   * one is only the budget quick-picker's starting symbol.
   */
  readonly defaultBudgetCurrency: ContractCurrency;
  /** i18n key for the showroom card-select's main label (Create-lead.dc.html `SHOWROOMS[].label`). */
  readonly showroomCardLabelKey: MessageKey;
  /** i18n key for the showroom card-select's sub line (Create-lead.dc.html `SHOWROOMS[].sub`). */
  readonly showroomCardSubKey: MessageKey;
}

export const OFFICE_CONFIG: Record<OfficeId, OfficeConfig> = {
  kyiv: {
    id: 'kyiv',
    nameKey: 'office.kyiv',
    flagEmoji: '🇺🇦',
    phoneFormat: 'ua',
    currency: 'UAH',
    timeZone: 'Europe/Kyiv',
    defaultLocale: 'uk',
    referencePrefix: 'K',
    sortOrder: 0,
    phoneCountryCode: '+380',
    phonePlaceholder: '+380 67 214 58 03',
    defaultBudgetCurrency: 'USD',
    showroomCardLabelKey: 'v2.form.showroom.kyivLabel',
    showroomCardSubKey: 'v2.form.showroom.kyivSub',
  },
  warsaw: {
    id: 'warsaw',
    nameKey: 'office.warsaw',
    flagEmoji: '🇵🇱',
    phoneFormat: 'pl',
    currency: 'PLN',
    timeZone: 'Europe/Warsaw',
    defaultLocale: 'pl',
    referencePrefix: 'W',
    sortOrder: 1,
    phoneCountryCode: '+48',
    phonePlaceholder: '+48 601 334 812',
    defaultBudgetCurrency: 'PLN',
    showroomCardLabelKey: 'v2.form.showroom.warsawLabel',
    showroomCardSubKey: 'v2.form.showroom.warsawSub',
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
