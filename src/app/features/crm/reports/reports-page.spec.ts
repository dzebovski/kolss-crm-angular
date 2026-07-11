import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '../../../core/api/generated/kolss-api.client';
import { SessionService } from '../../../core/session/session.service';
import { ReportsPage } from './reports-page';

describe('ReportsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        {
          provide: KolssApiClient,
          useValue: {
            report: async () => ({
              days: 40,
              funnel: { created: 12, taken: 10, scheduled: 6, visited: 4, successful: 2, closed: 2 },
              managers: [
                { officeCode: 'kyiv', managerId: 'manager-1', managerName: 'Kyiv Manager', takenCount: 3 },
                { officeCode: 'warsaw', managerId: 'manager-2', managerName: 'Warsaw Manager', takenCount: 2 },
              ],
            }),
          },
        },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            selectedOfficeId: () => null,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders cohort metrics and the accessible funnel', async () => {
    const fixture = TestBed.createComponent(ReportsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Звітність');
    expect(element.textContent).toContain('40 днів');
    expect(element.textContent).toContain('Зайшло лідів');
    expect(element.textContent).toContain('від Зайшло лідів');
    expect(element.textContent).toContain('Звіт по менеджерам');
    expect(element.textContent).toContain('Київ');
    expect(element.textContent).toContain('Варшава');
    expect(element.querySelectorAll('.funnel-list li').length).toBeGreaterThan(3);
    expect(element.querySelectorAll('.manager-office-panel').length).toBe(2);
  });
});
