/**
 * Live phone mask for the G3 popup controls (Popup-rules.dc.html "Masks and formats" +
 * Create-lead.dc.html script `phoneInfo`/`fmtPhone`/validate `phone`): "Phone: one field, no
 * separate code picker. The code is part of the number: +48 601 334 812 or
 * +380 67 214 58 03. Typed without a code, the showroom's code is added; 067… becomes
 * +380 67…."
 *
 * This is a *different* concern from `@core/phone/phone.ts` (`normalizePhoneForOffice` /
 * `formatPhoneDisplay`), which is v1-compatible storage/display formatting
 * (`+38 067 123 4567`, no space after the country code digits) used across v1 and the G2
 * `V2EditContactDialog`. Don't change that module — v1 must keep working. This one renders the
 * board's own grouping (`+380 67 214 58 03` / `+48 601 334 812`) for the new masked input only.
 */

/** The two country codes the popups accept — one per office (`OFFICE_CONFIG.phoneCountryCode`). */
export type V2PhoneCountryCode = '+48' | '+380';

export interface V2PhoneInfo {
  readonly cc: V2PhoneCountryCode | '';
  /** National digits after the country code, unbounded (the caller decides what's "enough"). */
  readonly rest: string;
}

/** Full national number length the popups require for either country (contract, not typed). */
export const V2_PHONE_NATIONAL_DIGITS = 9;

function digitsOnly(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

/** Splits a digit string into its recognised country code and the rest, per `phoneInfo`. */
export function v2PhoneInfo(value: string): V2PhoneInfo {
  const digits = digitsOnly(value);
  if (digits.startsWith('380')) return { cc: '+380', rest: digits.slice(3, 12) };
  if (digits.startsWith('48')) return { cc: '+48', rest: digits.slice(2, 11) };
  return { cc: '', rest: digits };
}

/** `+380` → `[2, 3, 2, 2]` (67 214 58 03); `+48` → `[3, 3, 3]` (601 334 812). */
const GROUPS: Record<V2PhoneCountryCode, readonly number[]> = {
  '+380': [2, 3, 2, 2],
  '+48': [3, 3, 3],
};

/**
 * Formats a phone value as the person types (`fmtPhone`): local shorthands get the office's
 * default code (`067…` → `380 67…`, a bare 9-digit number → `defaultCountryCode`), then the
 * digits are grouped for the recognised code. Unrecognised codes are returned with a leading
 * `+` and no grouping so the person can keep typing.
 */
export function v2FormatPhoneInput(value: string, defaultCountryCode: V2PhoneCountryCode): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  let digits = digitsOnly(raw);
  if (!digits) return raw.charAt(0) === '+' ? '+' : '';

  if (raw.charAt(0) !== '+') {
    if (digits.charAt(0) === '0' && digits.length > 1) {
      digits = `38${digits}`;
    } else if (!digits.startsWith('380') && !digits.startsWith('48')) {
      digits = (defaultCountryCode === '+380' ? '380' : '48') + digits;
    }
  }

  const info = v2PhoneInfo(digits);
  if (!info.cc) return `+${digits.slice(0, 13)}`;

  const groups = GROUPS[info.cc];
  const out: string[] = [info.cc];
  let i = 0;
  for (const size of groups) {
    if (i >= info.rest.length) break;
    out.push(info.rest.slice(i, i + size));
    i += size;
  }
  return out.join(' ');
}

export type V2PhoneValidation =
  | { readonly kind: 'ok' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'noCode' }
  | { readonly kind: 'incomplete'; readonly missingDigits: number };

/**
 * `validate()`'s phone rule: empty → required, no recognised code → "start with +48/+380",
 * fewer than 9 national digits → "N more digits needed". Never rejects extra digits (the mask
 * caps `rest` at 9 already through `v2PhoneInfo`/grouping).
 */
export function v2ValidatePhone(value: string): V2PhoneValidation {
  if (!digitsOnly(value)) return { kind: 'empty' };
  const info = v2PhoneInfo(value);
  if (!info.cc) return { kind: 'noCode' };
  if (info.rest.length < V2_PHONE_NATIONAL_DIGITS) {
    return { kind: 'incomplete', missingDigits: V2_PHONE_NATIONAL_DIGITS - info.rest.length };
  }
  return { kind: 'ok' };
}
