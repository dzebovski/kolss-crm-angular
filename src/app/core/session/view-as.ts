import { isOfficeId } from '@core/office/office.config';
import { ROLE_SUPER_ADMIN } from '@core/roles/roles';
import type { OfficeId } from '@domain/office.types';

export const VIEW_AS_STORAGE_KEY = 'kolss_view_as';

/**
 * Either "view everything" (the literal super-admin role value, reused as the
 * sentinel) or a specific office. Office scope and role are still folded into
 * one flat value here — see the office.config.ts phase-3b report for why a
 * full `{ kind: 'role' } | { kind: 'office' }` split was not worth it: nothing
 * outside this file/session.service.ts reads `viewAs`, so there is no real
 * consumer that would benefit from a richer shape, and the `localStorage`
 * format (this exact string) must stay unchanged either way.
 */
export type ViewAsMode = typeof ROLE_SUPER_ADMIN | OfficeId;

export function isViewAsMode(value: string | null | undefined): value is ViewAsMode {
  return value === ROLE_SUPER_ADMIN || isOfficeId(value);
}

export function readViewAsMode(): ViewAsMode {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return ROLE_SUPER_ADMIN;
    }
    const raw = localStorage.getItem(VIEW_AS_STORAGE_KEY);
    return isViewAsMode(raw) ? raw : ROLE_SUPER_ADMIN;
  } catch {
    return ROLE_SUPER_ADMIN;
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
    if (typeof localStorage === 'undefined' || typeof localStorage.removeItem !== 'function')
      return;
    localStorage.removeItem(VIEW_AS_STORAGE_KEY);
  } catch {
    // ignore
  }
}
