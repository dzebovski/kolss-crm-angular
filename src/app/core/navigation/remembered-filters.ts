import { DestroyRef, Service, inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  NavigationEnd,
  type Params,
  Router,
} from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';

// Remembered list filters (owner request, 2026-11-17): a page's filter and view query params
// (office, Month/Week, statuses, manager, period, tab) are kept per user in this browser and
// restored when the page is opened without them. Search text and the viewed date are not part
// of a route's `rememberParams`, so they always start fresh.
//
// A route opts in with `data: { [REMEMBER_PARAMS]: ['office', 'view'] }` and the
// `restoreRememberedFilters` guard. `RememberedFilters.start()` saves after every navigation.

export const REMEMBER_PARAMS = 'rememberParams';

const STORAGE_PREFIX = 'kolss.filters';

/** The remembered keys present in `params` (strings only); absent keys are left out. */
export function pickRememberedParams(
  params: Params,
  keys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value: unknown = params[key];
    if (typeof value === 'string' && value !== '') out[key] = value;
  }
  return out;
}

/** Route pattern from the root, e.g. `hr/employees/:employeeId` (same for every employee). */
export function routePatternOf(route: ActivatedRouteSnapshot): string {
  return route.pathFromRoot
    .map((snapshot) => snapshot.routeConfig?.path ?? '')
    .filter(Boolean)
    .join('/');
}

export function rememberedFiltersKey(userId: string, pattern: string): string {
  return `${STORAGE_PREFIX}.${userId}.${pattern}`;
}

function rememberParamsOf(route: ActivatedRouteSnapshot): readonly string[] {
  const keys: unknown = route.data[REMEMBER_PARAMS];
  return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string') : [];
}

function readStored(key: string): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? pickRememberedParams(parsed as Params, Object.keys(parsed))
      : {};
  } catch {
    return {};
  }
}

function writeStored(key: string, value: Record<string, string>): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures in tests or private mode
  }
}

/** Saves the opted-in route's filter params after every finished navigation. */
@Service()
export class RememberedFilters {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    const subscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.save());
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  private save(): void {
    const userId = this.auth.me()?.user.id;
    if (!userId) return;
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const keys = rememberParamsOf(route);
    if (keys.length === 0) return;
    writeStored(
      rememberedFiltersKey(userId, routePatternOf(route)),
      pickRememberedParams(route.queryParams, keys),
    );
  }
}

/**
 * Opens an opted-in page with the user's remembered filters when the URL carries none of them.
 * A URL with any remembered param (a shared link, a reset to defaults) is left as it is.
 */
export const restoreRememberedFilters: CanActivateFn = (route, state) => {
  const keys = rememberParamsOf(route);
  const userId = inject(AuthService).me()?.user.id;
  if (!userId || keys.length === 0) return true;
  if (Object.keys(pickRememberedParams(route.queryParams, keys)).length > 0) return true;
  const stored = pickRememberedParams(
    readStored(rememberedFiltersKey(userId, routePatternOf(route))),
    keys,
  );
  if (Object.keys(stored).length === 0) return true;
  const router = inject(Router);
  const tree = router.parseUrl(state.url);
  tree.queryParams = { ...tree.queryParams, ...stored };
  return tree;
};
