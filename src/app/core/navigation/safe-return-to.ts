const APP_FALLBACK = '/dashboard';
const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/leads',
  '/projects',
  '/clients',
  '/calendar',
  '/reports',
  '/accounts',
] as const;

export function safeAppReturnTo(value: string | null | undefined, fallback = APP_FALLBACK): string {
  if (!value || value.startsWith('//') || value.includes('\\') || hasControlChars(value)) {
    return fallback;
  }

  const base = 'http://kolss.local';
  let parsed: URL;
  try {
    parsed = new URL(value, base);
  } catch {
    return fallback;
  }

  if (parsed.origin !== base) return fallback;

  const pathname = canonicalPathname(parsed.pathname);
  if (
    !PROTECTED_ROUTE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }

  return `${pathname}${parsed.search}${parsed.hash}`;
}

function canonicalPathname(pathname: string): string {
  if (pathname === '/crm') return '/leads';
  return pathname.startsWith('/crm/') ? pathname.slice('/crm'.length) : pathname;
}

function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f) return true;
  }
  return false;
}
