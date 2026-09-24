// Remembers whether the v2 side menu is open, per browser (a viewer preference, not synced).
const STORAGE_KEY = 'kolss_v2_menu_open';

export function readV2MenuOpen(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeV2MenuOpen(open: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    // ignore storage failures in tests or private mode
  }
}
