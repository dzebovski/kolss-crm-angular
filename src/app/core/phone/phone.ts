export type PhoneOfficeCode = 'kyiv' | 'warsaw' | string;

/**
 * Normalizes a phone for storage. Returns null when empty or not a valid
 * full number for the office (use for form validation before save).
 */
export function normalizePhoneForOffice(
  raw: string | null | undefined,
  officeCode: PhoneOfficeCode,
): string | null {
  if (!raw?.trim() || raw.trim() === '—') return null;

  const digits = raw.replace(/^p:/i, '').replace(/\D/g, '');
  if (!digits) return null;

  if (officeCode === 'warsaw') {
    return formatPolishPhone(digits, true);
  }

  return formatUkrainianPhone(digits, true);
}

/**
 * Formats a phone for display. Falls back to the trimmed raw value when the
 * number cannot be fully normalized (legacy / partial data).
 */
export function formatPhoneDisplay(
  raw: string | null | undefined,
  officeCode?: PhoneOfficeCode | null,
): string {
  if (raw == null) return '—';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—') return '—';

  const digits = trimmed.replace(/^p:/i, '').replace(/\D/g, '');
  if (!digits) return trimmed;

  const code = officeCode ?? detectOfficeCodeFromDigits(digits);
  const formatted =
    code === 'warsaw'
      ? formatPolishPhone(digits, true)
      : formatUkrainianPhone(digits, true);

  return formatted ?? trimmed;
}

function detectOfficeCodeFromDigits(digits: string): PhoneOfficeCode {
  if (digits.startsWith('48') && !digits.startsWith('380') && !digits.startsWith('38')) {
    return 'warsaw';
  }
  // National PL mobiles are 9 digits without country code; UA national are 10 with leading 0.
  if (digits.length === 9 && !digits.startsWith('0')) {
    return 'warsaw';
  }
  return 'kyiv';
}

function formatUkrainianPhone(digits: string, strict: boolean): string | null {
  let normalized = digits;
  if (normalized.startsWith('380')) normalized = normalized.slice(3);
  else if (normalized.startsWith('38')) normalized = normalized.slice(2);

  if (normalized.length === 9 && !normalized.startsWith('0')) {
    normalized = `0${normalized}`;
  }

  if (normalized.length > 10) normalized = normalized.slice(-10);

  if (normalized.length !== 10 || !normalized.startsWith('0')) {
    return strict ? null : `+38 ${normalized}`;
  }

  return `+38 ${normalized.slice(0, 3)} ${normalized.slice(3, 10)}`;
}

function formatPolishPhone(digits: string, strict: boolean): string | null {
  let normalized = digits;
  if (normalized.startsWith('48')) normalized = normalized.slice(2);
  if (normalized.length > 9) normalized = normalized.slice(-9);

  if (normalized.length !== 9) {
    return strict ? null : `+48 ${normalized}`;
  }

  return `+48 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)}`;
}
