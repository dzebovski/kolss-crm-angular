import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService, type LeadsListFilters } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiSelect } from '../../../ui/form/ui-select';
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
        {
          provide: UsersService,
          useValue: {
            listManagers: async () => [
              {
                id: 'emp-kyiv-1',
                displayName: 'Данило Мороз',
                role: 'office_member',
                officeIds: ['kyiv'],
                status: 'active',
              },
            ],
          },
        },
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

  it('shows the call author below the status independently from the assigned manager', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        assignedToId: 'emp-kyiv-1',
        callStatus: 'reached',
        callStatusActor: {
          actorId: 'emp-kyiv-2',
          actorName: 'Софія Литвин',
        },
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.lead-row td');

    expect(cells[2]?.textContent).toContain('Данило Мороз');
    expect(cells[2]?.textContent).not.toContain('Софія Литвин');
    expect(cells[3]?.textContent).toContain('Успішний дзвінок');
    expect(cells[3]?.querySelector('.call-status-actor')?.textContent).toContain('Софія Литвин');
  });

  it('does not render an author line when the current call author is unknown', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        callStatus: 'reached',
        callStatusActor: null,
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const callCell = (fixture.nativeElement as HTMLElement).querySelector(
      '.lead-row td:nth-child(4)',
    );

    expect(callCell?.textContent).toContain('Успішний дзвінок');
    expect(callCell?.querySelector('.call-status-actor')).toBeNull();
  });

  it('shows and updates the count for the current filters', async () => {
    list.mockResolvedValueOnce([CRM_MOCK_LEADS[1]!, CRM_MOCK_LEADS[2]!]).mockResolvedValueOnce([]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const count = element.querySelector('.title-row h1 + .lead-count');
    expect(count?.textContent).toContain('Відображається');
    expect(count?.textContent).not.toContain('фільтрами');
    expect(count?.querySelector('.lead-count-badge')?.textContent).toContain('2 лідів');
    expect(count?.querySelector('.lead-count-badge app-ui-icon')).not.toBeNull();

    const callStatusSelect = fixture.debugElement.queryAll(By.directive(UiSelect))[0]
      ?.componentInstance as UiSelect;
    callStatusSelect.value.set('reached');
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ callStatus: 'reached' }));
    expect(element.querySelector('.lead-count-badge')?.textContent).toContain('0 лідів');
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
    expect(cells[3]?.textContent).toContain('До 25.07');
    expect(cells[3]?.textContent).not.toContain('2026');
    expect(cells[4]?.textContent).toContain('Думає');
    expect(cells[4]?.textContent).toContain('До 25.07');
    expect(cells[4]?.textContent).not.toContain('2026');
    expect(cells[3]?.querySelector('app-ui-icon')).toBeTruthy();
    expect(cells[4]?.querySelector('app-ui-icon')).toBeTruthy();
    expect(cells[3]?.querySelector(':scope > app-ui-badge + app-lead-due-date')).toBeTruthy();
    expect(cells[4]?.querySelector(':scope > app-ui-badge + app-lead-due-date')).toBeTruthy();
  });

  it('shows showroom and comment dates at the same time', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        callStatus: 'reached',
        clientStatus: 'showroom_invited',
        callbackDueAt: '2026-07-22T12:00:00.000Z',
        commentReminderDueAt: '2026-07-22T12:00:00.000Z',
        callbackDueContext: { category: 'comment', statusCode: null },
        showroomDueAt: '2026-07-25T12:00:00.000Z',
        latestTimelineComment: {
          comment: 'Повторно набрати 22.07',
          occurredAt: '2026-07-18T10:00:00.000Z',
          eventType: 'comment_added',
          category: 'comment',
          statusCode: null,
          newValue: { callback_due_at: '2026-07-22T12:00:00.000Z' },
        },
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.lead-row td');

    expect(cells[4]?.textContent).toContain('Запрошено в салон');
    expect(cells[4]?.textContent).not.toContain('Нагадування');
    expect(cells[4]?.textContent).toContain('До 25.07');
    expect(cells[4]?.textContent).not.toContain('22.07');
    expect(cells[5]?.querySelector('.comment-next-action')?.textContent).toContain(
      'Нагадування до',
    );
    expect(cells[5]?.textContent).toContain('22.07');
    expect(cells[5]?.textContent).not.toContain('2026');
  });

  it('hides an old comment reminder after a newer comment without a date', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        callbackDueAt: '2026-07-22T12:00:00.000Z',
        callbackDueContext: { category: 'comment', statusCode: null },
        commentReminderDueAt: null,
        latestTimelineComment: {
          comment: 'Клієнт надіслав уточнення без нагадування',
          occurredAt: '2026-07-19T10:00:00.000Z',
          eventType: 'comment_added',
          category: 'comment',
          statusCode: null,
          newValue: {},
        },
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const commentCell = (fixture.nativeElement as HTMLElement).querySelector(
      '.lead-row td:nth-child(6)',
    );

    expect(commentCell?.textContent).toContain('Клієнт надіслав уточнення');
    expect(commentCell?.querySelector('.comment-next-action')).toBeNull();
    expect(commentCell?.textContent).not.toContain('22.07');
  });

  it('keeps a comment reminder visible after a later dated status', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        callStatus: 'callback_requested',
        callbackDueAt: '2026-07-25T12:00:00.000Z',
        commentReminderDueAt: '2026-07-22T12:00:00.000Z',
        latestTimelineComment: {
          comment: 'Передзвонити після обіду',
          occurredAt: '2026-07-20T10:00:00.000Z',
          eventType: 'call_status_changed',
          category: 'call_status',
          statusCode: 'callback_requested',
          newValue: { callback_due_at: '2026-07-25T12:00:00.000Z' },
        },
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.lead-row td');

    expect(cells[3]?.textContent).toContain('До 25.07');
    expect(cells[5]?.querySelector('.comment-next-action')?.textContent).toContain('22.07');
  });

  it('shows a showroom date under the client status, not as a comment reminder', async () => {
    list.mockResolvedValueOnce([
      {
        ...CRM_MOCK_LEADS[2]!,
        callStatus: 'reached',
        clientStatus: 'showroom_invited',
        callbackDueAt: '2026-08-03T12:00:00.000Z',
        callbackDueContext: { category: 'client_status', statusCode: 'showroom_invited' },
      },
    ]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.lead-row td');

    expect(cells[4]?.textContent).toContain('Запрошено в салон');
    expect(cells[4]?.textContent).toContain('До 03.08');
    expect(cells[5]?.querySelector('.comment-next-action')).toBeNull();
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
