import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { setActiveLocale } from '../../../core/i18n/locale-storage';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { UsersService, type CrmEmployee } from '../../../services/users.service';
import { LeadsPage } from './leads-page';

describe('LeadsPage', () => {
  beforeEach(async () => {
    setActiveLocale('uk');
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
            listManagers: async () => [],
          },
        },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            selectedOfficeId: () => null,
            officeContext: () => ({
              filterOffices: [
                {
                  id: 'office-kyiv',
                  code: 'kyiv',
                  name_uk: 'Київ',
                  name_pl: 'Kijów',
                  is_active: true,
                },
              ],
            }),
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

  it('shows current assignee in manager column when firstManagerId differs', async () => {
    const assignee: CrmEmployee = {
      id: 'emp-kyiv-2',
      email: 'sofia.lytvyn@kolss.com',
      displayName: 'Софія Литвин',
      role: 'office_member',
      officeIds: ['kyiv'],
      officeUuids: ['office-kyiv'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      lastActiveAt: '2026-07-07T08:00:00.000Z',
    };
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[0]!,
      id: 'lead-assignee-mismatch',
      assignedToId: assignee.id,
      firstManagerId: 'emp-missing-from-managers',
    };

    TestBed.overrideProvider(LeadsService, {
      useValue: {
        list: async () => [lead],
      },
    });
    TestBed.overrideProvider(UsersService, {
      useValue: {
        listManagers: async () => [assignee],
      },
    });

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const headings = Array.from(element.querySelectorAll('.leads-table thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(headings).toContain('Менеджер');
    expect(headings).not.toContain('Перший менеджер');

    const row = element.querySelector<HTMLElement>(`[data-lead-id="${lead.id}"]`);
    const managerCell = row?.querySelector('.manager-cell');
    expect(managerCell?.textContent).toContain('Софія Литвин');
    expect(managerCell?.textContent).not.toContain('Не призначено');
  });

  it('shows first-call comment as primary text in call cell', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const headings = Array.from(element.querySelectorAll('.leads-table thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(headings).toContain('Статус');

    const comment = element.querySelector('.call-cell__comment');
    expect(comment).toBeTruthy();
    expect(comment?.textContent).toContain('Клієнт планує замір після вихідних.');
    expect(comment?.getAttribute('title')).toBe('Клієнт планує замір після вихідних.');
    expect(comment?.closest('.call-cell')?.textContent).toContain('Потреба підтверджена');
  });

  it('shows close comment and reason in Status cell for closed leads', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const closedRow = element.querySelector<HTMLElement>('[data-lead-id="lead-1008"]');
    expect(closedRow).toBeTruthy();

    const callCell = closedRow?.querySelector('.call-cell');
    const comment = callCell?.querySelector('.call-cell__comment');
    expect(comment?.textContent).toContain('Після пояснення бюджету клієнт відмовився.');
    expect(comment?.getAttribute('title')).toBe('Після пояснення бюджету клієнт відмовився.');
    expect(callCell?.textContent).toContain('Дорого');
    expect(callCell?.textContent).not.toContain('Клієнт шукає значно дешевше рішення.');
  });

  it('shows empty Status cell when lead has no close and no first call', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const emptyRow = CRM_MOCK_LEADS.find((lead) => !lead.close && !lead.firstCall);
    expect(emptyRow).toBeTruthy();

    const row = element.querySelector<HTMLElement>(`[data-lead-id="${emptyRow!.id}"]`);
    const callCell = row?.querySelector('.call-cell');
    expect(callCell?.textContent).toContain('Ще не зафіксовано');
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

  it('opens create lead dialog from header action', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll('app-ui-button button'));
    const createButton = buttons.find((button) => button.textContent?.includes('Створити лід')) as
      | HTMLButtonElement
      | undefined;
    createButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('app-create-lead-dialog')).toBeTruthy();
  });

  it('filters leads with exclusive workflow status toggles', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const filterButtons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.status-filter-bar .period-switcher button'),
    );
    expect(filterButtons).toHaveLength(5);

    const visitButton = filterButtons.find((button) => button.textContent?.includes('Візит у салон'));
    const closedButton = filterButtons.find((button) => button.textContent?.includes('Закриті'));
    const contractButton = filterButtons.find((button) => button.textContent?.includes('Договір'));
    expect(visitButton).toBeTruthy();
    expect(closedButton).toBeTruthy();
    expect(contractButton).toBeTruthy();

    visitButton!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['workflowFilter']()).toBe('visit');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(3);
    expect(visitButton!.classList.contains('is-active')).toBe(true);

    closedButton!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['workflowFilter']()).toBe('closed');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(2);
    expect(visitButton!.classList.contains('is-active')).toBe(false);
    expect(closedButton!.classList.contains('is-active')).toBe(true);

    contractButton!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['workflowFilter']()).toBe('successful');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(1);

    contractButton!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['workflowFilter']()).toBeNull();
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(CRM_MOCK_LEADS.length);
  });

  it('navigates to new lead after successful creation', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['onLeadCreated']('lead-new-1');

    expect(navigateSpy).toHaveBeenCalledWith(['/crm/leads', 'lead-new-1']);
  });
});
