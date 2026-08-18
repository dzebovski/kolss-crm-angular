import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';

import { AuthService } from '@core/auth/auth.service';
import { SessionService } from '@core/session/session.service';
import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import type { Lead } from '@domain/lead.types';
import { LeadsService, type LeadsListFilters } from '@services/leads.service';
import { UsersService } from '@services/users.service';
import { UiMultiSelect } from '@ui/form/ui-multi-select';
import { UiSwitch } from '@ui/form/ui-switch';
import { UiTextField } from '@ui/form/ui-text-field';
import { LeadsPage } from './leads-page';
import { LEADS_PAGE_PREFERENCES_STORAGE_KEY } from './leads-page-preferences.storage';

describe('LeadsPage', () => {
  const storedValues = new Map<string, string>();
  const setOfficeFilter = vi.fn();
  const kyivOffice = { id: 'office-kyiv', code: 'kyiv', name: 'Kyiv' };
  let officeFilter = 'all';
  let officeContext: {
    canFilter: boolean;
    filterOffices: readonly { code: string }[];
  } | null = { canFilter: false, filterOffices: [kyivOffice] };
  const list = vi.fn(async (filters: LeadsListFilters): Promise<readonly Lead[]> => {
    void filters;
    return [
      {
        ...FIXTURE_LEADS[2]!,
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
    setOfficeFilter.mockClear();
    officeFilter = 'all';
    officeContext = { canFilter: false, filterOffices: [kyivOffice] };
    await TestBed.configureTestingModule({
      imports: [LeadsPage],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
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
            selectedOfficeId: () => (officeFilter === 'all' ? null : kyivOffice.id),
            officeFilter: () => officeFilter,
            showOfficeFilter: () => officeContext?.canFilter ?? false,
            officeContext: () => officeContext,
            loaded: () => officeContext !== null,
            setOfficeFilter,
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
        ...FIXTURE_LEADS[2]!,
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

  it('shows the close reason next to the client status for a closed_lost lead', async () => {
    list.mockResolvedValueOnce([FIXTURE_LEADS[7]!]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    const cells = (fixture.nativeElement as HTMLElement).querySelectorAll('.lead-row td');

    expect(cells[4]?.textContent).toContain('Закрито');
    expect(cells[4]?.textContent).toContain('Дорого');
  });

  it('does not render an author line when the current call author is unknown', async () => {
    list.mockResolvedValueOnce([
      {
        ...FIXTURE_LEADS[2]!,
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
    list.mockResolvedValueOnce([FIXTURE_LEADS[1]!, FIXTURE_LEADS[2]!]).mockResolvedValueOnce([]);
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const count = element.querySelector('.title-row h1 + .lead-count');
    expect(count?.textContent).toContain('Відображається');
    expect(count?.textContent).not.toContain('фільтрами');
    expect(count?.querySelector('.lead-count-badge')?.textContent).toContain('2 лідів');
    expect(count?.querySelector('.lead-count-badge app-ui-icon')).not.toBeNull();

    const callStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[0]
      ?.componentInstance as UiMultiSelect;
    callStatusSelect.value.set(['reached']);
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ callStatus: ['reached'] }));
    expect(element.querySelector('.lead-count-badge')?.textContent).toContain('0 лідів');
  });

  it('combines multiple call statuses for the same filter with OR', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    list.mockClear();

    const callStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[0]
      ?.componentInstance as UiMultiSelect;
    callStatusSelect.value.set(['reached', 'no_answer']);
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ callStatus: ['reached', 'no_answer'] }),
    );
  });

  it('exposes separate new lead and in progress client status filters', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const clientStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[1]
      ?.componentInstance as UiMultiSelect;
    const optionValues = clientStatusSelect.options().map((option) => option.value);
    expect(optionValues).toEqual([
      'new_lead',
      'in_work',
      'showroom_invited',
      'measurement_scheduled',
      'calculation_in_progress',
      'thinking',
      'closed_lost',
      'contract_signed',
    ]);
    expect(clientStatusSelect.options().find((option) => option.value === 'in_work')?.label).toBe(
      'В роботі',
    );

    clientStatusSelect.value.set(['new_lead']);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['new_lead'] }));

    clientStatusSelect.value.set(['in_work']);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['in_work'] }));
  });

  it('exposes the no-call and undated-callback cohorts in the call status filter', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const callStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[0]
      ?.componentInstance as UiMultiSelect;
    const optionValues = callStatusSelect.options().map((option) => option.value);
    expect(optionValues).toEqual([
      'reached',
      'no_answer',
      'callback_requested',
      'none',
      'callback_undated',
    ]);
    expect(callStatusSelect.options().find((option) => option.value === 'none')?.label).toBe(
      'Не телефонували',
    );
    expect(
      callStatusSelect.options().find((option) => option.value === 'callback_undated')?.label,
    ).toBe('Передзвонити без дати');

    callStatusSelect.value.set(['none', 'callback_undated']);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ callStatus: ['none', 'callback_undated'] }),
    );
  });

  it('renders natural-language chips for the no-call and undated-callback cohorts', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    list.mockClear();

    const callStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[0]
      ?.componentInstance as UiMultiSelect;
    callStatusSelect.value.set(['none', 'callback_undated']);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const chips = Array.from(element.querySelectorAll('.filter-chips app-ui-chip'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
      'Не телефонували',
      'Передзвонити без дати',
    ]);
  });

  it('keeps the "active" cohort out of the client-status dropdown, offering it via a separate switch instead', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    list.mockClear();

    const activeSwitch = fixture.debugElement.query(By.directive(UiSwitch))
      ?.componentInstance as UiSwitch;
    const clientStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[1]
      ?.componentInstance as UiMultiSelect;
    expect(activeSwitch).toBeTruthy();
    expect(activeSwitch.checked()).toBe(false);
    expect(clientStatusSelect.options().map((option) => option.value)).not.toContain('active');

    activeSwitch.checked.set(true);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['active'] }));

    activeSwitch.checked.set(false);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: [] }));
  });

  it('keeps every filter field in one grid row and places the active switch at the right edge', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const filters = (fixture.nativeElement as HTMLElement).querySelector('.filters');
    expect(filters?.children.length).toBe(5);
    expect(filters?.querySelector(':scope > .client-status-filter')).toBeNull();
    expect(filters?.querySelector(':scope > app-ui-switch.active-clients-filter')).toBeTruthy();
  });

  // Regression: "active" ORs with every other clientStatus value at the API,
  // so `active` next to a concrete status (e.g. `active OR closed_lost`)
  // would silently widen the result instead of narrowing it — a switch
  // labelled "active" that quietly shows *more* leads. The two controls must
  // therefore be mutually exclusive: turning "active" on can never coexist
  // with a concrete selection, in either direction, and `list` must never see
  // a `clientStatus` array containing both `active` and a concrete status.
  it('makes "active" + a concrete client status an unreachable combination', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    list.mockClear();

    const activeSwitch = fixture.debugElement.query(By.directive(UiSwitch))
      ?.componentInstance as UiSwitch;
    const clientStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[1]
      ?.componentInstance as UiMultiSelect;

    // Turning "active" on while a concrete status is selected replaces it,
    // rather than adding to it.
    clientStatusSelect.value.set(['thinking']);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['thinking'] }));

    activeSwitch.checked.set(true);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['active'] }));
    expect(clientStatusSelect.value()).toEqual([]);

    // Picking a concrete status while "active" is on exits "active" mode,
    // rather than combining with it.
    clientStatusSelect.value.set(['new_lead']);
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['new_lead'] }));
    expect(activeSwitch.checked()).toBe(false);

    // Across every call made during this whole sequence, `active` never once
    // appeared alongside a concrete status.
    for (const call of list.mock.calls) {
      const clientStatus = call[0]?.clientStatus ?? [];
      if (clientStatus.includes('active')) {
        expect(clientStatus).toEqual(['active']);
      }
    }
  });

  it('resolves a deep link with both "active" and a concrete status (e.g. a hand-edited URL) to "active" alone', async () => {
    await TestBed.inject(Router).navigateByUrl('/crm/leads?clientStatus=active,thinking&days=all');

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['active'] }));

    const activeSwitch = fixture.debugElement.query(By.directive(UiSwitch))
      ?.componentInstance as UiSwitch;
    const clientStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[1]
      ?.componentInstance as UiMultiSelect;
    expect(activeSwitch.checked()).toBe(true);
    expect(clientStatusSelect.value()).toEqual([]);
  });

  it('renders a chip per selected client status and removing one keeps the rest', async () => {
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();
    list.mockClear();

    const clientStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[1]
      ?.componentInstance as UiMultiSelect;
    clientStatusSelect.value.set(['new_lead', 'thinking']);
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ clientStatus: ['new_lead', 'thinking'] }),
    );

    const element = fixture.nativeElement as HTMLElement;
    const chips = Array.from(element.querySelectorAll('.filter-chips app-ui-chip'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Нова заявка'),
        expect.stringContaining('Думає'),
      ]),
    );

    const removeButtons = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.filter-chips app-ui-chip button'),
    );
    const thinkingRemove = removeButtons.find((button) =>
      button.getAttribute('aria-label')?.includes('Думає'),
    );
    thinkingRemove?.click();
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ clientStatus: ['new_lead'] }));
    expect(
      Array.from(element.querySelectorAll('.filter-chips app-ui-chip')).map((chip) =>
        chip.textContent?.trim(),
      ),
    ).toEqual([expect.stringContaining('Нова заявка')]);
  });

  it('shows a new lead as in progress after any call result is recorded', async () => {
    list.mockResolvedValueOnce([
      {
        ...FIXTURE_LEADS[2]!,
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
        ...FIXTURE_LEADS[2]!,
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
        ...FIXTURE_LEADS[2]!,
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
        ...FIXTURE_LEADS[2]!,
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
        ...FIXTURE_LEADS[2]!,
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
        ...FIXTURE_LEADS[2]!,
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
        ...FIXTURE_LEADS[2]!,
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

  it('loads a shared filter link instead of the stored preferences', async () => {
    storedValues.set(
      LEADS_PAGE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        periodDays: 180,
        callStatusFilter: ['reached'],
        clientStatusFilter: [],
        managerFilter: 'emp-kyiv-1',
      }),
    );
    await TestBed.inject(Router).navigateByUrl('/crm/leads?clientStatus=new_lead&days=30');

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clientStatus: ['new_lead'],
        days: 30,
        callStatus: [],
        assignedTo: null,
      }),
    );
  });

  it('mirrors the selected filters in the URL so the view can be shared', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/crm/leads');
    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const clientStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[1]
      ?.componentInstance as UiMultiSelect;
    clientStatusSelect.value.set(['new_lead']);
    await fixture.whenStable();

    expect(router.url).toContain('clientStatus=new_lead');
    expect(router.url).toContain('days=7');
  });

  it('applies a linked office the user can filter by', async () => {
    officeContext = { canFilter: true, filterOffices: [kyivOffice] };
    await TestBed.inject(Router).navigateByUrl('/crm/leads?office=kyiv&clientStatus=new_lead');

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    expect(setOfficeFilter).toHaveBeenCalledWith('kyiv');
  });

  it('ignores a linked office the user has no access to', async () => {
    officeContext = { canFilter: true, filterOffices: [kyivOffice] };
    await TestBed.inject(Router).navigateByUrl('/crm/leads?office=warsaw&clientStatus=new_lead');

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    expect(setOfficeFilter).not.toHaveBeenCalled();
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ officeId: null, clientStatus: ['new_lead'] }),
    );
  });

  it('resolves the "not yet called" digest deep link (callStatus=none&clientStatus=active&days=all)', async () => {
    await TestBed.inject(Router).navigateByUrl(
      '/crm/leads?office=warsaw&callStatus=none&clientStatus=active&days=all',
    );

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        callStatus: ['none'],
        clientStatus: ['active'],
        days: null,
      }),
    );
  });

  // The morning digest URL-encodes its comma-separated callStatus list as
  // `%2C` (e.g. `no_answer%2Ccallback_undated`). Angular's router decodes
  // query param values before `queryParamMap` sees them, so the existing
  // comma-splitting parser should already handle it — this proves it against
  // the literal encoded URL instead of assuming the decode happens.
  it('resolves the digest deep link with a URL-encoded comma (callStatus=no_answer%2Ccallback_undated)', async () => {
    await TestBed.inject(Router).navigateByUrl(
      '/crm/leads?office=warsaw&callStatus=no_answer%2Ccallback_undated&clientStatus=active&days=all',
    );

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        callStatus: ['no_answer', 'callback_undated'],
        clientStatus: ['active'],
        days: null,
      }),
    );
  });

  it('reflects a linked "active" client status through the switch, not the dropdown', async () => {
    await TestBed.inject(Router).navigateByUrl('/crm/leads?clientStatus=active&days=all');

    const fixture = TestBed.createComponent(LeadsPage);
    await fixture.whenStable();

    const activeSwitch = fixture.debugElement.query(By.directive(UiSwitch))
      ?.componentInstance as UiSwitch;
    expect(activeSwitch.checked()).toBe(true);

    const clientStatusSelect = fixture.debugElement.queryAll(By.directive(UiMultiSelect))[1]
      ?.componentInstance as UiMultiSelect;
    expect(clientStatusSelect.value()).toEqual([]);
  });

  it('debounces rapid search input into a single leadsResource request', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(LeadsPage);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      await fixture.whenStable();
      list.mockClear();

      const searchField = fixture.debugElement.query(By.directive(UiTextField))
        ?.componentInstance as UiTextField;

      searchField.value.set('a');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(100);

      searchField.value.set('ab');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(100);

      searchField.value.set('abc');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(100);

      // Each keystroke landed under the 300ms debounce window, so no search
      // request has fired yet for any intermediate value.
      expect(list).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);
      await fixture.whenStable();

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ search: 'abc' }));
    } finally {
      vi.useRealTimers();
    }
  });
});
