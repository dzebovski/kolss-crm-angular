export const VIEW_AS_STORAGE_KEY = 'kolss_view_as';

export type ViewAsMode = 'super_admin' | 'kyiv' | 'warsaw';

export function isViewAsMode(value: string | null | undefined): value is ViewAsMode {
  return value === 'super_admin' || value === 'kyiv' || value === 'warsaw';
}

export function readViewAsMode(): ViewAsMode {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return 'super_admin';
    }
    const raw = localStorage.getItem(VIEW_AS_STORAGE_KEY);
    return isViewAsMode(raw) ? raw : 'super_admin';
  } catch {
    return 'super_admin';
  }
}

export function writeViewAsMode(mode: ViewAsMode): void {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') return;
    localStorage.setItem(VIEW_AS_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function clearViewAsMode(): void {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.removeItem !== 'function') return;
    localStorage.removeItem(VIEW_AS_STORAGE_KEY);
  } catch {
    // ignore
  }
}
