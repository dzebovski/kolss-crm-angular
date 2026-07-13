const STORAGE_KEY = 'kolss_impersonate_user_id';

export function readImpersonatedUserId(): string | null {
  try {
    if (typeof sessionStorage === 'undefined' || typeof sessionStorage.getItem !== 'function') {
      return null;
    }
    const value = sessionStorage.getItem(STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function writeImpersonatedUserId(userId: string): void {
  const trimmed = userId.trim();
  if (!trimmed) {
    clearImpersonatedUserId();
    return;
  }
  try {
    if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.setItem === 'function') {
      sessionStorage.setItem(STORAGE_KEY, trimmed);
    }
  } catch {
    // ignore storage failures in tests or private mode
  }
}

export function clearImpersonatedUserId(): void {
  try {
    if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.removeItem === 'function') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage failures in tests or private mode
  }
}

export const IMPERSONATION_STORAGE_KEY = STORAGE_KEY;
