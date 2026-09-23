import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  RedirectCommand,
  Router,
  type RouterStateSnapshot,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { legacyCrmMatcher, legacyCrmRedirectGuard } from './legacy-crm-redirect';

@Component({ template: '' })
class RoutedPage {}

describe('legacy CRM route redirect', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { matcher: legacyCrmMatcher, canActivate: [legacyCrmRedirectGuard], children: [] },
          { path: 'leads', component: RoutedPage },
          { path: 'leads/:leadId', component: RoutedPage },
          { path: 'calendar', component: RoutedPage },
          { path: '', pathMatch: 'full', component: RoutedPage },
        ]),
      ],
    });
  });

  it('redirects the legacy root to leads', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/crm');

    expect(TestBed.inject(Router).url).toBe('/leads');
  });

  it('preserves nested paths, query parameters, and fragments', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/crm/leads/lead-1?office=warsaw#activity');

    expect(TestBed.inject(Router).url).toBe('/leads/lead-1?office=warsaw#activity');
  });

  it('replaces the legacy browser-history entry', () => {
    const result = TestBed.runInInjectionContext(() =>
      legacyCrmRedirectGuard(
        {} as ActivatedRouteSnapshot,
        {
          url: '/crm/calendar?office=warsaw#today',
        } as RouterStateSnapshot,
      ),
    );

    expect(result).toBeInstanceOf(RedirectCommand);
    expect((result as RedirectCommand).navigationBehaviorOptions?.replaceUrl).toBe(true);
  });
});
