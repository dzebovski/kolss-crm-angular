import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomePage } from './home-page';

describe('HomePage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('keeps the Angular starter and links to KOLSS Design', async () => {
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const designLink = element.querySelector<HTMLAnchorElement>('a[routerlink="/design"]');

    expect(element.querySelector('h1')?.textContent).toContain('Hello, kolss-crm-angular');
    expect(designLink?.textContent).toContain('KOLSS Design');
  });
});
