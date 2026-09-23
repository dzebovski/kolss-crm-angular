import { inject } from '@angular/core';
import {
  PRIMARY_OUTLET,
  RedirectCommand,
  Router,
  type CanActivateFn,
  type UrlMatcher,
} from '@angular/router';

export const legacyCrmMatcher: UrlMatcher = (segments) =>
  segments.at(0)?.path === 'crm' ? { consumed: segments } : null;

export const legacyCrmRedirectGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const source = router.parseUrl(state.url);
  const sourceSegments = source.root.children[PRIMARY_OUTLET]?.segments ?? [];
  const canonicalSegments = sourceSegments.slice(1).map((segment) => segment.path);
  const commands = canonicalSegments.length > 0 ? ['/', ...canonicalSegments] : ['/leads'];
  const redirectTo = router.createUrlTree(commands, {
    queryParams: source.queryParams,
    fragment: source.fragment ?? undefined,
  });

  return new RedirectCommand(redirectTo, { replaceUrl: true });
};
