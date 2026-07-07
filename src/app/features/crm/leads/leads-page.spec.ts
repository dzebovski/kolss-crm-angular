import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { LeadsPage } from './leads-page';

describe('LeadsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadsPage],
      providers: [
        provideRouter([]),
        {
          provide: LeadsService,
          useValue: {
            list: async () => CRM_MOCK_LEADS,
          },
        },
        {
          provide: UsersService,
          useValue: {
            listEmployees: async () => [],
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

  it('renders grouped leads and search metrics', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Ліди');
    expect(element.textContent).toContain('липень 2026');
    expect(element.textContent).toContain('Марина Гончар');
    expect(element.textContent).toContain('10');
    expect(element.querySelectorAll('.leads-table')).toHaveLength(1);
    expect(element.querySelectorAll('.leads-table thead th')).toHaveLength(6);
    expect(element.querySelectorAll('.month-row').length).toBeGreaterThanOrEqual(2);
    expect(element.querySelector('.month-row')?.textContent).toContain('лідів');
  });

  it('opens lead detail from a table row', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const row = element.querySelector<HTMLElement>('.lead-row');
    const leadId = row?.dataset['leadId'];
    row?.click();

    expect(leadId).toBeTruthy();
    expect(navigateSpy).toHaveBeenCalledWith(['/crm/leads', leadId]);
  });
});
