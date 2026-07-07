import { TestBed } from '@angular/core/testing';

import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import { LeadsService } from '../../../services/leads.service';
import { ReportsPage } from './reports-page';

describe('ReportsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsPage],
      providers: [
        {
          provide: LeadsService,
          useValue: {
            list: async () => CRM_MOCK_LEADS,
          },
        },
        {
          provide: SessionService,
          useValue: {
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
    expect(element.querySelectorAll('.funnel-list li').length).toBeGreaterThan(3);
  });
});
