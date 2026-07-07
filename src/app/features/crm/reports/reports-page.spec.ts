import { TestBed } from '@angular/core/testing';

import { ReportsPage } from './reports-page';

describe('ReportsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
    }).compileComponents();
  });

  it('renders cohort metrics and the accessible funnel', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Звітність');
    expect(element.textContent).toContain('40 днів');
    expect(element.textContent).toContain('Зайшло лідів');
    expect(element.querySelectorAll('.funnel-list li').length).toBeGreaterThan(3);
  });
});
