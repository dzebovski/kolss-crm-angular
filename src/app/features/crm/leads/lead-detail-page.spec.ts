import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import { LeadWorkflowService } from '../../../services/lead-workflow.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { LeadDetailPage } from './lead-detail-page';

describe('LeadDetailPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ leadId: 'lead-1007' }),
            },
          },
        },
        {
          provide: LeadsService,
          useValue: {
            getById: async (leadId: string) =>
              CRM_MOCK_LEADS.find((lead) => lead.id === leadId) ?? null,
          },
        },
        {
          provide: UsersService,
          useValue: {
            listEmployees: async () => [],
          },
        },
        {
          provide: LeadWorkflowService,
          useValue: {},
        },
      ],
    }).compileComponents();
  });

  it('renders successful terminal state for a converted lead', async () => {
    const fixture = TestBed.createComponent(LeadDetailPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Катерина Савчук');
    expect(element.textContent).toContain('Лід успішно завершено');
    expect(element.textContent).toContain('K-KY-2026-0618');
  });
});
