import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService, type LeadsListFilters } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { LeadsPage } from './leads-page';

describe('LeadsPage', () => {
  const storedValues = new Map<string, string>();
  const list = vi.fn(async (filters: LeadsListFilters): Promise<readonly MockLead[]> => {
    void filters;
    return [
      {
        ...CRM_MOCK_LEADS[2]!,
        callStatus: 'reached',
        clientStatus: 'calculation_in_progress',
        latestTimelineComment: {
          comment: 'Погодили матеріали фасадів.',
          occurredAt: '2026-07-01T16:10:00.000Z',
          eventType: 'call_status_changed',
          category: 'call_status',
          statusCode: 'reached',
          newValue: null,
        },
      },
    ];
  });

  beforeEach(async () => {
    vi.stubGlobal('localStorage', {
      clear: () => storedValues.clear(),
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => storedValues.set(key, value),
      removeItem: (key: string) => storedValues.delete(key),
      key: () => null,
      get length() {
        return storedValues.size;
      },
    });
    localStorage.clear();
    list.mockClear();
    await TestBed.configureTestingModule({
      imports: [LeadsPage],
      providers: [
        provideRouter([]),
        { provide: LeadsService, useValue: { list } },
        { provide: UsersService, useValue: { listManagers: async () => [] } },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            selectedOfficeId: () => null,
            officeFilter: () => 'all',
          },
        },
        { provide: AuthService, useValue: { profile: () => ({ role: 'office_member' }) } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders the six status-based columns and latest timeline comment context', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const headings = Array.from(element.querySelectorAll('thead th')).map((node) =>
      node.textContent?.trim(),
    );
    expect(headings).toEqual(['Дата', 'Клієнт', 'Менеджер', 'Дзвінок', 'Статус', 'Коментар']);
    expect(element.textContent).toContain('Успішний дзвінок');
    expect(element.textContent).toContain('Прорахунок');
    expect(element.textContent).toContain('Погодили матеріали фасадів.');
    expect(element.textContent).not.toContain('Візит у салон');
  });

  it('shows a new lead as in progress after any call result is recorded', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        clientStatus: 'new_lead',
        callStatus: 'no_answer',
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const statusCell = (fixture.nativeElement as HTMLElement).querySelector(
      '.lead-row td:nth-child(5)',
    );

    expect(statusCell?.textContent).toContain('В роботі');
    expect(statusCell?.textContent).not.toContain('Нова заявка');
  });

  it('keeps the new lead status before the first call action', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        clientStatus: 'new_lead',
        callStatus: null,
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const statusCell = (fixture.nativeElement as HTMLElement).querySelector(
      '.lead-row td:nth-child(5)',
    );

    expect(statusCell?.textContent).toContain('Нова заявка');
    expect(statusCell?.textContent).not.toContain('В роботі');
  });

  it('shows the selected date next to callback and waiting statuses', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        callStatus: 'callback_requested',
        clientStatus: 'thinking',
        callbackDueAt: '2026-07-25T12:00:00.000Z',
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.lead-row td');

    expect(cells[3]?.textContent).toContain('Передзвонити');
    expect(cells[3]?.textContent).toContain('25.07.2026');
    expect(cells[4]?.textContent).toContain('Думає');
    expect(cells[4]?.textContent).toContain('25.07.2026');
  });

  it('opens a lead from a table row', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.lead-row')?.click();
    expect(navigate).toHaveBeenCalledWith(['/crm/leads', 'lead-1003']);
  });
});
