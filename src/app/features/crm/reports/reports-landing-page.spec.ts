import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';

import { SessionService } from '@core/session/session.service';
import { routes } from '../../../app.routes';
import { ReportsLandingPage } from './reports-landing-page';

describe('ReportsLandingPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsLandingPage],
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: { locale: () => 'uk' },
        },
      ],
    }).compileComponents();
  });

  it('offers the two report destinations', async () => {
    const fixture = TestBed.createComponent(ReportsLandingPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Звітність по лідах');
    expect(element.textContent).toContain('Звітність по воронці');
    expect(
      [...element.querySelectorAll<HTMLAnchorElement>('.report-option a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/reports/leads-status', '/reports/sales-funnel']);
  });

  it('registers landing and both lazy report routes', () => {
    const workspace = routes.find((route) => route.path === '' && route.children);
    expect(workspace?.children?.map((route) => route.path)).toEqual(
      expect.arrayContaining(['reports', 'reports/leads-status', 'reports/sales-funnel']),
    );
  });

  it('passes an automated accessibility scan', async () => {
    const fixture = TestBed.createComponent(ReportsLandingPage);
    await fixture.whenStable();

    const result = await axe.run(fixture.nativeElement as HTMLElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
