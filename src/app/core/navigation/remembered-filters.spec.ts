import type { ActivatedRouteSnapshot } from '@angular/router';

import { pickRememberedParams, rememberedFiltersKey, routePatternOf } from './remembered-filters';

function snapshot(paths: readonly string[]): ActivatedRouteSnapshot {
  return {
    pathFromRoot: [{ routeConfig: null }, ...paths.map((path) => ({ routeConfig: { path } }))],
  } as unknown as ActivatedRouteSnapshot;
}

describe('remembered filters', () => {
  it('keeps only the listed, non-empty string params', () => {
    expect(
      pickRememberedParams({ office: 'w1', view: '', q: 'anna', at: '2026-11-17', status: ['a'] }, [
        'office',
        'view',
        'status',
      ]),
    ).toEqual({ office: 'w1' });
  });

  it('builds the route pattern from the root, not the concrete ids', () => {
    expect(routePatternOf(snapshot(['hr', '', 'employees/:employeeId']))).toBe(
      'hr/employees/:employeeId',
    );
  });

  it('scopes the storage key by user', () => {
    expect(rememberedFiltersKey('u1', 'hr/calendar')).toBe('kolss.filters.u1.hr/calendar');
  });
});
