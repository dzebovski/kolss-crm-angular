import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LeadsPage } from './leads-page';

describe('LeadsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadsPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders grouped mock leads and search metrics', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Ліди');
    expect(element.textContent).toContain('липень 2026');
    expect(element.textContent).toContain('Марина Гончар');
    expect(element.textContent).toContain('10');
  });
});
