import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { setActiveLocale } from '../../../core/i18n/locale-storage';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { UsersService, type CrmEmployee } from '../../../services/users.service';
import { LeadsPage } from './leads-page';

describe('LeadsPage', () => {
  beforeEach(async () => {
    localStorage.clear();
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
            officeFilter: () => 'all',
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

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the controls above the unchanged grouped leads table', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const overview = element.querySelector('.leads-overview');
    const primaryControls = overview?.querySelector('.leads-overview__primary');
    const secondaryControls = overview?.querySelector('.leads-overview__secondary');
    const statusFilters = primaryControls?.querySelector('.status-filter-bar');
    const managerFilter = primaryControls?.querySelector('.manager-filter-bar');
    const tablePanel = element.querySelector('.leads-table-panel');

    expect(element.textContent).toContain('Ліди');
    expect(element.textContent).toContain('липень 2026');
    expect(element.textContent).toContain('Марина Гончар');
    expect(element.textContent).toContain('10');
    expect(primaryControls?.querySelector('h1')).toBeTruthy();
    expect(primaryControls?.querySelector('app-ui-text-field')).toBeTruthy();
    expect(statusFilters).toBeTruthy();
    expect(managerFilter).toBeTruthy();
    expect(managerFilter?.querySelector('app-ui-select')).toBeTruthy();
    expect(element.textContent).toContain('Показати по менеджеру');
    expect(secondaryControls?.querySelector('.page-actions')).toBeTruthy();
    expect(secondaryControls?.querySelector('.period-switcher--range')).toBeTruthy();
    expect(
      managerFilter!.compareDocumentPosition(statusFilters!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      statusFilters!.compareDocumentPosition(tablePanel!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(element.querySelector('.page-kicker')).toBeNull();
    expect(element.querySelector('.toolbar-metrics')).toBeNull();
    expect(element.textContent).not.toContain('Робочий список лідів з Supabase');
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

    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll('app-ui-button button'));
    const createButton = buttons.find((button) => button.textContent?.includes('Створити лід')) as
      HTMLButtonElement | undefined;
    createButton?.click();
    await fixture.whenStable();

    expect(element.querySelector('app-create-lead-dialog')).toBeTruthy();
  });

  it('preserves search, period, and super-admin archive controls', async () => {
    TestBed.overrideProvider(AuthService, {
      useValue: {
        profile: () => ({ role: 'super_admin' }),
      },
    });

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const searchInput = element.querySelector<HTMLInputElement>('.leads-search input');
    const periodButtons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.period-switcher--range button'),
    );
    const weekButton = periodButtons.find((button) => button.textContent?.includes('Тиждень'));
    const monthButton = periodButtons.find((button) => button.textContent?.includes('Місяць'));
    const archiveButton = Array.from(element.querySelectorAll('app-ui-button button')).find(
      (button) => button.textContent?.includes('Показати архів'),
    ) as HTMLButtonElement | undefined;

    expect(searchInput).toBeTruthy();
    expect(weekButton?.getAttribute('aria-pressed')).toBe('true');
    expect(monthButton?.getAttribute('aria-pressed')).toBe('false');
    expect(archiveButton).toBeTruthy();

    searchInput!.value = 'Марина';
    searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance['query']()).toBe('Марина');

    monthButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['periodDays']()).toBe(30);
    expect(monthButton!.getAttribute('aria-pressed')).toBe('true');
    expect(weekButton!.getAttribute('aria-pressed')).toBe('false');

    archiveButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['showArchived']()).toBe(true);
    expect(archiveButton!.textContent).toContain('Показати активні');
  });

  it('filters leads by selected manager and clears via chip', async () => {
    const assignee: CrmEmployee = {
      id: 'emp-kyiv-1',
      email: 'marina.honchar@kolss.com',
      displayName: 'Марина Гончар',
      role: 'office_member',
      officeIds: ['kyiv'],
      officeUuids: ['office-kyiv'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      lastActiveAt: '2026-07-07T08:00:00.000Z',
    };
    const other: CrmEmployee = {
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
    const leads: MockLead[] = [
      { ...CRM_MOCK_LEADS[0]!, id: 'lead-mgr-a', assignedToId: assignee.id },
      { ...CRM_MOCK_LEADS[1]!, id: 'lead-mgr-b', assignedToId: other.id },
      { ...CRM_MOCK_LEADS[2]!, id: 'lead-mgr-c', assignedToId: assignee.id },
    ];

    TestBed.overrideProvider(LeadsService, {
      useValue: {
        list: async () => leads,
      },
    });
    TestBed.overrideProvider(UsersService, {
      useValue: {
        listManagers: async () => [assignee, other],
      },
    });

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(3);

    fixture.componentInstance['managerFilter'].set(assignee.id);
    await fixture.whenStable();

    const filtered = fixture.componentInstance['filteredLeads']();
    expect(filtered).toHaveLength(2);
    expect(filtered.every((lead) => lead.assignedToId === assignee.id)).toBe(true);

    const element = fixture.nativeElement as HTMLElement;
    const chip = element.querySelector('app-ui-chip');
    expect(chip?.textContent).toContain('Марина Гончар');

    const removeButton = chip?.querySelector('button');
    removeButton?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance['managerFilter']()).toBe('');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(3);
    expect(element.querySelector('app-ui-chip')).toBeNull();
  });

  it('keeps exactly one workflow status filter selected', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const filterButtons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.period-switcher--status button'),
    );
    expect(filterButtons).toHaveLength(6);

    const allButton = filterButtons.find((button) => button.textContent?.trim() === 'Всі');
    const visitButton = filterButtons.find((button) =>
      button.textContent?.includes('Візит у салон'),
    );
    const closedButton = filterButtons.find((button) => button.textContent?.includes('Закриті'));
    const contractButton = filterButtons.find((button) => button.textContent?.includes('Договір'));
    expect(allButton).toBeTruthy();
    expect(visitButton).toBeTruthy();
    expect(closedButton).toBeTruthy();
    expect(contractButton).toBeTruthy();

    expect(fixture.componentInstance['workflowFilter']()).toBeNull();
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(CRM_MOCK_LEADS.length);
    expect(allButton!.classList.contains('is-active')).toBe(true);
    expect(allButton!.getAttribute('aria-pressed')).toBe('true');

    visitButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['workflowFilter']()).toBe('visit');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(3);
    expect(visitButton!.classList.contains('is-active')).toBe(true);
    expect(visitButton!.getAttribute('aria-pressed')).toBe('true');
    expect(allButton!.getAttribute('aria-pressed')).toBe('false');

    visitButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['workflowFilter']()).toBe('visit');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(3);

    closedButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['workflowFilter']()).toBe('closed');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(2);
    expect(visitButton!.classList.contains('is-active')).toBe(false);
    expect(closedButton!.classList.contains('is-active')).toBe(true);

    contractButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['workflowFilter']()).toBe('successful');
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(1);

    allButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['workflowFilter']()).toBeNull();
    expect(fixture.componentInstance['filteredLeads']()).toHaveLength(CRM_MOCK_LEADS.length);
    expect(allButton!.getAttribute('aria-pressed')).toBe('true');
  });

  it('restores period and workflow filter from localStorage on new instance', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const monthButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.period-switcher--range button'),
    ).find((button) => button.textContent?.includes('Місяць'));
    const visitButton = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.period-switcher--status button'),
    ).find((button) => button.textContent?.includes('Візит у салон'));

    monthButton!.click();
    visitButton!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance['periodDays']()).toBe(30);
    expect(fixture.componentInstance['workflowFilter']()).toBe('visit');

    fixture.destroy();

    const restored = TestBed.createComponent(LeadsPage);
    await restored.whenStable();
    expect(restored.componentInstance['periodDays']()).toBe(30);
    expect(restored.componentInstance['workflowFilter']()).toBe('visit');
  });

  it('navigates to new lead after successful creation', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    await fixture.componentInstance['onLeadCreated']('lead-new-1');

    expect(navigateSpy).toHaveBeenCalledWith(['/crm/leads', 'lead-new-1']);
  });
});
