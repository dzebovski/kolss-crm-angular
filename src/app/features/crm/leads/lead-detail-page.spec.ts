import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadActivitiesService } from '../../../services/lead-activities.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { LeadDetailPage } from './lead-detail-page';

describe('LeadDetailPage', () => {
  async function render(lead: MockLead) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LeadDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ leadId: lead.id }) } },
        },
        { provide: LeadsService, useValue: { getById: async () => lead } },
        {
          provide: LeadActivitiesService,
          useValue: {
            recordCall: vi.fn(),
            addComment: vi.fn(),
            setClientStatus: vi.fn(),
            closeLead: vi.fn(),
            signContract: vi.fn(),
            reopen: vi.fn(),
          },
        },
        { provide: UsersService, useValue: { listManagers: async () => [] } },
        { provide: UiDialogService, useValue: { open: vi.fn() } },
        {
          provide: SessionService,
          useValue: { locale: () => 'uk' },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LeadDetailPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows client data, independent current statuses and timeline', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[2]!,
      callStatus: 'reached',
      clientStatus: 'calculation_in_progress',
    };
    const fixture = await render(lead);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Контакт і запит');
    expect(text).toContain('Успішний дзвінок');
    expect(text).toContain('Прорахунок');
    expect(text).toContain('Таймлайн взаємодій');
  });

  it('blocks ordinary actions for a terminal lead and offers reopen', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      clientStatus: 'closed_lost',
    };
    const fixture = await render(lead);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Перевідкрити');
    expect(element.querySelector('.status-actions')).toBeNull();
  });
});
