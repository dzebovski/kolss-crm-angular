// Month groups the viewer collapsed on the v2 leads list, per browser (`YYYY-MM` keys).
const STORAGE_KEY = 'kolss_v2_leads_collapsed_months';

export function readV2CollapsedMonths(): ReadonlySet<string> {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeV2CollapsedMonths(keys: ReadonlySet<string>): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // ignore storage failures in tests or private mode
  }
}
