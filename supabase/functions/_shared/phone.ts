export function normalizePhoneForOffice(
  raw: string | null | undefined,
  officeCode: string,
): string | null {
  if (!raw?.trim()) return null;

  const digits = raw.replace(/^p:/i, '').replace(/\D/g, '');
  if (!digits) return null;

  if (officeCode === 'warsaw') {
    return formatPolishPhone(digits);
  }

  return formatUkrainianPhone(digits);
}

function formatUkrainianPhone(digits: string): string | null {
  let normalized = digits;
  if (normalized.startsWith('380')) normalized = normalized.slice(3);
  else if (normalized.startsWith('38')) normalized = normalized.slice(2);

  if (normalized.length === 9 && !normalized.startsWith('0')) {
    normalized = `0${normalized}`;
  }

  if (normalized.length > 10) normalized = normalized.slice(-10);
  if (normalized.length !== 10 || !normalized.startsWith('0')) {
    return `+38 ${normalized}`;
  }

  return `+38 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 10)}`;
}

function formatPolishPhone(digits: string): string | null {
  let normalized = digits;
  if (normalized.startsWith('48')) normalized = normalized.slice(2);
  if (normalized.length > 9) normalized = normalized.slice(-9);
  if (normalized.length !== 9) {
    return `+48 ${normalized}`;
  }
  return `+48 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)}`;
}
