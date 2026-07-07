const CRM_FALLBACK = '/crm/dashboard';

export function safeCrmReturnTo(value: string | null | undefined, fallback = CRM_FALLBACK): string {
  if (!value || value.startsWith('//') || value.includes('\\') || hasControlChars(value)) {
    return fallback;
  }

  const base = 'http://kolss.local';
  const parsed = new URL(value, base);
  if (
    parsed.origin !== base ||
    (parsed.pathname !== '/crm' && !parsed.pathname.startsWith('/crm/'))
  ) {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f) return true;
  }
  return false;
}
