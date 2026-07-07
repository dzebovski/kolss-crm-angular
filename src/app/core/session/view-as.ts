export const VIEW_AS_STORAGE_KEY = 'kolss_view_as';

export type ViewAsMode = 'super_admin' | 'kyiv' | 'warsaw';

export function isViewAsMode(value: string | null | undefined): value is ViewAsMode {
  return value === 'super_admin' || value === 'kyiv' || value === 'warsaw';
}

export function readViewAsMode(): ViewAsMode {
  if (typeof localStorage === 'undefined') return 'super_admin';
  const raw = localStorage.getItem(VIEW_AS_STORAGE_KEY);
  return isViewAsMode(raw) ? raw : 'super_admin';
}

export function writeViewAsMode(mode: ViewAsMode): void {
  localStorage.setItem(VIEW_AS_STORAGE_KEY, mode);
}

export function clearViewAsMode(): void {
  localStorage.removeItem(VIEW_AS_STORAGE_KEY);
}
