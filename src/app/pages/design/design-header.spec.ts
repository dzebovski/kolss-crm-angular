import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { DesignHeader } from './design-header';

describe('DesignHeader', () => {
  it('links to the catalog and radial menu and marks the active page', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'design', component: DesignHeader },
          { path: 'design/radial-menu', component: DesignHeader },
        ]),
      ],
    });

    const fixture = TestBed.createComponent(DesignHeader);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/design/radial-menu');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll('.design-nav a')) as HTMLAnchorElement[];

    expect(links.map((link) => link.textContent?.trim())).toEqual(['Catalog', 'Radial Menu']);
    expect(links[0].classList.contains('is-active')).toBe(false);
    expect(links[1].classList.contains('is-active')).toBe(true);
  });
});
