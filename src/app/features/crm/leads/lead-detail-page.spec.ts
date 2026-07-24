import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import axe from 'axe-core';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import type { UserRole } from '../../../models/database';
import { CRM_MOCK_EMPLOYEES, CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { LeadEvent, MockLead } from '../../../services/crm-mock.types';
import { LeadActivitiesService } from '../../../services/lead-activities.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { AppointmentsService } from '../../../services/appointments.service';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiUser } from '../../../ui/user/ui-user';
import { LeadDetailView } from './lead-detail-page';

describe('LeadDetailView', () => {
  async function render(
    lead: MockLead,
    options: {
      role?: UserRole;
      managers?: typeof CRM_MOCK_EMPLOYEES;
      updateLeadDetails?: ReturnType<typeof vi.fn>;
      translateHistoryEvent?: ReturnType<typeof vi.fn>;
      userOffices?: { code: string }[];
    } = {},
  ) {
    TestBed.resetTestingModule();
    const updateLeadDetails = options.updateLeadDetails ?? vi.fn(async () => undefined);
    const getById = vi.fn(async () => lead);
    const archiveLead = vi.fn(async () => undefined);
    const restoreLead = vi.fn(async () => undefined);
    const deleteLeadPermanently = vi.fn(async () => undefined);
    const translateHistoryEvent =
      options.translateHistoryEvent ??
      vi.fn(async () => ({
        translation: 'English translation',
        sourceLanguage: 'UK',
        translatedAt: '2026-07-20T12:00:00.000Z',
      }));
    const activities = {
      recordCall: vi.fn(),
      addComment: vi.fn(),
      setClientStatus: vi.fn(),
      closeLead: vi.fn(),
      signContract: vi.fn(),
      reopen: vi.fn(),
    };
    const dialogOpen = vi.fn();
    const dialogConfirm = vi.fn();
    const appointmentsList = vi.fn(async () => ({
      items: [],
      timezone: lead.officeCode === 'warsaw' ? 'Europe/Warsaw' : 'Europe/Kyiv',
      from: '2026-08-03',
      to: '2026-08-04',
    }));
    await TestBed.configureTestingModule({
      imports: [LeadDetailView],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ leadId: lead.id }) } },
        },
        {
          provide: AuthService,
          useValue: { profile: () => ({ role: options.role ?? 'office_member' }) },
        },
        {
          provide: LeadsService,
          useValue: {
            getById,
            updateLeadDetails,
            archiveLead,
            restoreLead,
            deleteLeadPermanently,
            translateHistoryEvent,
          },
        },
        { provide: LeadActivitiesService, useValue: activities },
        { provide: AppointmentsService, useValue: { list: appointmentsList } },
        {
          provide: UsersService,
          useValue: { listManagers: async () => options.managers ?? CRM_MOCK_EMPLOYEES },
        },
        { provide: UiDialogService, useValue: { open: dialogOpen, confirm: dialogConfirm } },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            officeContext: () => ({
              userOffices: options.userOffices ?? [{ code: lead.officeCode }],
              filterOffices: [
                {
                  id: `office-${lead.officeCode}`,
                  code: lead.officeCode,
                  name_uk: lead.officeCode === 'warsaw' ? 'Варшава' : 'Київ',
                  name_pl: lead.officeCode === 'warsaw' ? 'Warszawa' : 'Kijów',
                  timezone_name: lead.officeCode === 'warsaw' ? 'Europe/Warsaw' : 'Europe/Kyiv',
                  is_active: true,
                },
              ],
            }),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LeadDetailView);
    fixture.componentRef.setInput('leadId', lead.id);
    await fixture.whenStable();
    return {
      activities,
      appointmentsList,
      archiveLead,
      deleteLeadPermanently,
      dialogConfirm,
      dialogOpen,
      fixture,
      getById,
      restoreLead,
      translateHistoryEvent,
      updateLeadDetails,
    };
  }

  function findButton(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function findActionButton(element: HTMLElement, label: string): HTMLButtonElement | undefined {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('.lead-actions button')).find(
      (button) => button.textContent?.includes(label),
    );
  }

  it('renders the summary, status strip, actions and full-width timeline in workflow order', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[2]!,
      email: 'oleksandr@example.com',
      callStatus: 'reached',
      clientStatus: 'calculation_in_progress',
    };
    const { fixture } = await render(lead);
    const element = fixture.nativeElement as HTMLElement;
    const summary = element.querySelector('.lead-summary');
    const text = element.textContent ?? '';
    expect(summary).not.toBeNull();
    expect(summary?.querySelector('.client-data')).not.toBeNull();
    expect(summary?.querySelector('a[href^="tel:"]')).not.toBeNull();
    expect(summary?.querySelector('.manager-card')).not.toBeNull();
    expect(summary?.querySelector('.lead-facts > .manager-card')).not.toBeNull();
    expect(summary?.querySelector('aside.manager-card')).toBeNull();
    expect(element.querySelector('.client-panel')).toBeNull();
    expect(element.querySelector('.status-panel')).toBeNull();
    expect(summary?.textContent).toContain('Дата');
    expect(summary?.textContent).toContain('Джерело');
    expect(summary?.textContent).toContain(lead.cityRegion);
    expect(summary?.textContent).toContain(lead.email);
    expect(summary?.textContent).toContain(lead.productInterest);
    expect(summary?.textContent).toContain(lead.initialMessage);
    expect(text).toContain('Контакт і запит');
    expect(text).toContain('Успішний дзвінок');
    expect(text).toContain('Прорахунок');
    expect(text).toContain('Таймлайн взаємодій');

    const workflowSections = Array.from(
      element.querySelectorAll('.lead-summary, .status-strip, .lead-actions, .timeline-panel'),
    ).map((section) => section.classList[0]);
    expect(workflowSections).toEqual([
      'lead-summary',
      'status-strip',
      'lead-actions',
      'timeline-panel',
    ]);

    const actionLabels = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.lead-actions button'),
    ).map((button) => button.textContent?.replace(/\s+/g, ' ').trim());
    expect(actionLabels).toEqual(['Додати коментар', 'Дзвінок ↗', 'Статус клієнта']);
    expect(element.querySelectorAll('.lead-action--status app-ui-icon')).toHaveLength(1);
  });

  it('renders every timeline card as title, optional status, comment and actor metadata', async () => {
    const events: readonly LeadEvent[] = [
      {
        id: 'client-status-with-comment',
        type: 'client_status_changed',
        rawType: 'client_status_changed',
        comment: 'Клієнт очікує фінальний кошторис.',
        newValue: { client_status: 'calculation_in_progress' },
        actorId: 'emp-kyiv-1',
        actorName: 'Данило Мороз',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: 'client_status',
        statusCode: 'calculation_in_progress',
      },
      {
        id: 'call-status-without-comment',
        type: 'call_status_changed',
        rawType: 'call_status_changed',
        comment: null,
        newValue: { call_status: 'callback_requested' },
        actorId: 'emp-kyiv-2',
        actorName: 'Софія Литвин',
        occurredAt: '2026-07-16T08:30:00.000Z',
        category: 'call_status',
        statusCode: 'callback_requested',
      },
      {
        id: 'manager-comment',
        type: 'comment_added',
        rawType: 'comment_added',
        comment: 'Надіслано приклади матеріалів.',
        newValue: { callback_due_at: '2026-07-22T12:00:00.000Z' },
        actorId: 'emp-kyiv-1',
        actorName: 'Данило Мороз',
        occurredAt: '2026-07-15T16:00:00.000Z',
        category: 'comment',
        statusCode: null,
      },
      {
        id: 'legacy-note',
        type: 'lead_updated',
        rawType: 'legacy_note',
        comment: 'Імпортовано зі старої CRM.',
        newValue: null,
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-14T12:00:00.000Z',
        category: null,
        statusCode: null,
      },
    ];
    const lead: MockLead = { ...CRM_MOCK_LEADS[2]!, events };
    const { fixture } = await render(lead);
    const element = fixture.nativeElement as HTMLElement;
    const cards = Array.from(element.querySelectorAll<HTMLElement>('.timeline-card'));

    expect(cards).toHaveLength(4);
    expect(Array.from(cards[0]!.children).map((child) => child.tagName.toLowerCase())).toEqual([
      'header',
      'app-ui-badge',
      'p',
      'app-ui-button',
      'footer',
    ]);
    expect(cards[0]!.querySelector('.ui-badge--warning')?.textContent).toContain('Прорахунок');
    expect(cards[0]!.querySelector('p')?.textContent).toContain(
      'Клієнт очікує фінальний кошторис.',
    );
    expect(cards[0]!.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-07-16T09:15:00.000Z',
    );

    expect(cards[1]!.querySelector('.ui-badge--brand')?.textContent).toContain('Передзвонити');
    expect(cards[1]!.querySelector('p')).toBeNull();
    expect(cards[1]!.textContent?.match(/Передзвонити/g)).toHaveLength(1);

    expect(cards[2]!.querySelector('app-ui-badge')).toBeNull();
    expect(cards[2]!.querySelector('p')?.textContent).toContain('Надіслано приклади матеріалів.');
    expect(cards[2]!.querySelector('.timeline-card__due time')?.getAttribute('datetime')).toBe(
      '2026-07-22T12:00:00.000Z',
    );
    expect(cards[3]!.querySelector('app-ui-badge')).toBeNull();
    expect(cards[3]!.querySelector('.ui-user__fallback')).not.toBeNull();

    const timelineUsers = fixture.debugElement.queryAll(By.css('.timeline-card__meta app-ui-user'));
    const firstTimelineUser = timelineUsers[0]!.componentInstance as UiUser;
    const fallbackTimelineUser = timelineUsers[3]!.componentInstance as UiUser;
    expect(firstTimelineUser.userId()).toBe('emp-kyiv-1');
    expect(firstTimelineUser.name()).toBe('Данило Мороз');
    expect(firstTimelineUser.size()).toBe('xs');
    expect(fallbackTimelineUser.userId()).toBeNull();
    expect(fallbackTimelineUser.name()).toBe('Не призначено');
  });

  it('renders callback, thinking and showroom dates consistently in the timeline', async () => {
    const dueAt = '2026-08-03T12:00:00.000Z';
    const events: readonly LeadEvent[] = [
      {
        id: 'callback-date',
        type: 'call_status_changed',
        rawType: 'call_status_changed',
        comment: null,
        newValue: { call_status: 'callback_requested', callback_due_at: dueAt },
        actorId: 'emp-kyiv-1',
        actorName: 'Данило Мороз',
        occurredAt: '2026-08-01T10:00:00.000Z',
        category: 'call_status',
        statusCode: 'callback_requested',
      },
      {
        id: 'thinking-date',
        type: 'client_status_changed',
        rawType: 'client_status_changed',
        comment: null,
        newValue: { client_status: 'thinking', callback_due_at: dueAt },
        actorId: 'emp-kyiv-1',
        actorName: 'Данило Мороз',
        occurredAt: '2026-08-01T09:00:00.000Z',
        category: 'client_status',
        statusCode: 'thinking',
      },
      {
        id: 'showroom-date',
        type: 'client_status_changed',
        rawType: 'client_status_changed',
        comment: null,
        newValue: { client_status: 'showroom_invited', callback_due_at: dueAt },
        actorId: 'emp-kyiv-1',
        actorName: 'Данило Мороз',
        occurredAt: '2026-08-01T08:00:00.000Z',
        category: 'client_status',
        statusCode: 'showroom_invited',
      },
    ];
    const { fixture } = await render({ ...CRM_MOCK_LEADS[2]!, events });
    const dueDates = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.timeline-card__due'),
    );

    expect(dueDates).toHaveLength(3);
    for (const due of dueDates) {
      expect(due.textContent).toContain('До 03.08');
      expect(due.textContent).not.toContain('2026');
      expect(due.querySelector('time')?.getAttribute('datetime')).toBe(dueAt);
      expect(due.querySelector('app-ui-icon')).toBeTruthy();
    }
  });

  it('shows saved English text below the original and hides the translate button', async () => {
    const event: LeadEvent = {
      id: 'translated-comment',
      type: 'comment_added',
      rawType: 'comment_added',
      comment: 'Клієнт підтвердив розміри.',
      translationEn: 'The client confirmed the measurements.',
      translationSourceLanguage: 'UK',
      translatedAt: '2026-07-20T12:00:00.000Z',
      newValue: null,
      actorId: 'emp-kyiv-1',
      actorName: 'Данило Мороз',
      occurredAt: '2026-07-20T11:00:00.000Z',
      category: 'comment',
      statusCode: null,
    };
    const lead = { ...CRM_MOCK_LEADS[2]!, events: [event] };
    const { fixture } = await render(lead);
    const card = (fixture.nativeElement as HTMLElement).querySelector('.timeline-card')!;

    expect(card.querySelector('.timeline-card__translation')?.textContent).toContain(
      'The client confirmed the measurements.',
    );
    expect(findButton(card as HTMLElement, 'Перекласти англійською')).toBeUndefined();
  });

  it('requests a translation for any event comment and shows a retryable localized error', async () => {
    const event: LeadEvent = {
      id: 'status-comment',
      type: 'client_status_changed',
      rawType: 'client_status_changed',
      comment: 'Очікує фінальний кошторис.',
      newValue: null,
      actorId: 'emp-kyiv-1',
      occurredAt: '2026-07-20T11:00:00.000Z',
      category: 'client_status',
      statusCode: 'calculation_in_progress',
    };
    const translateHistoryEvent = vi.fn().mockRejectedValue(new Error('provider unavailable'));
    const lead = { ...CRM_MOCK_LEADS[2]!, events: [event] };
    const { fixture } = await render(lead, { translateHistoryEvent });
    const element = fixture.nativeElement as HTMLElement;

    findButton(element, 'Перекласти англійською')?.click();
    await fixture.whenStable();

    expect(translateHistoryEvent).toHaveBeenCalledWith(lead.id, event.id);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Не вдалося перекласти коментар',
    );
    expect(findButton(element, 'Перекласти англійською')).toBeTruthy();
  });

  it('has no automated accessibility violations in the timeline', async () => {
    const { fixture } = await render(CRM_MOCK_LEADS[2]!);
    const timeline = (fixture.nativeElement as HTMLElement).querySelector(
      '.timeline-panel',
    ) as HTMLElement;

    expect((await axe.run(timeline)).violations).toEqual([]);
  });

  it('blocks ordinary actions for a terminal lead and offers reopen and archive', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      clientStatus: 'closed_lost',
    };
    const { activities, fixture } = await render(lead, { role: 'super_admin' });
    const element = fixture.nativeElement as HTMLElement;
    const summary = element.querySelector('.terminal-summary') as HTMLElement | null;
    const terminalNote = element.querySelector('.terminal-note') as HTMLElement | null;
    const managerCard = element.querySelector('.manager-card') as HTMLElement | null;

    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain(
      'Закрито - Дорого - Після пояснення бюджету клієнт відмовився.',
    );
    expect(terminalNote).not.toBeNull();
    expect(findButton(terminalNote!, 'Перевідкрити')).toBeTruthy();
    expect(findButton(summary!, 'Архівувати')).toBeTruthy();
    expect(managerCard?.textContent).not.toContain('Відкрити');
    expect(managerCard?.textContent).not.toContain('Архівувати');
    expect(element.querySelector('.lead-actions')).toBeNull();
    expect(element.querySelector('.terminal-note')).not.toBeNull();
    expect(element.querySelector('.manager-card__edit')).not.toBeNull();

    findButton(terminalNote!, 'Перевідкрити')?.click();
    await fixture.whenStable();
    expect(activities.reopen).toHaveBeenCalledWith(lead.id);
  });

  it('hides archive for a successful contract lead', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[6]!,
      clientStatus: 'contract_signed',
      archivedAt: null,
    };
    const { fixture } = await render(lead, { role: 'super_admin' });
    const element = fixture.nativeElement as HTMLElement;
    const summary = element.querySelector('.terminal-summary--success') as HTMLElement | null;
    const terminalNote = element.querySelector('.terminal-note') as HTMLElement | null;

    expect(summary).not.toBeNull();
    expect(findButton(terminalNote!, 'Перевідкрити')).toBeTruthy();
    expect(findButton(summary!, 'Перевідкрити')).toBeUndefined();
    expect(findButton(summary!, 'Архівувати')).toBeUndefined();
    expect(element.querySelector('.manager-card')?.textContent).not.toContain('Відкрити');
  });

  it('offers restore and permanent delete for an archived lead to super admins', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      archivedAt: '2026-07-17T12:30:00.000Z',
    };
    const { fixture } = await render(lead, { role: 'super_admin' });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.lead-actions')).toBeNull();
    expect(element.querySelector('.manager-card__edit')).toBeNull();
    expect(element.textContent).toContain('Архівна заявка доступна лише для перегляду');
    expect(element.textContent).toContain('Відновити з архіву');
    expect(element.textContent).toContain('Видалити остаточно');
    expect(element.textContent).not.toContain('Відкрити');
  });

  it('keeps archived lead actions hidden for non-super-admins', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      archivedAt: '2026-07-17T12:30:00.000Z',
    };
    const { fixture } = await render(lead, { role: 'office_member' });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Архівна заявка доступна лише для перегляду');
    expect(element.textContent).not.toContain('Відновити з архіву');
    expect(element.textContent).not.toContain('Видалити остаточно');
  });

  it('archives a closed lead after confirmation', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      clientStatus: 'closed_lost',
    };
    const { archiveLead, dialogConfirm, fixture } = await render(lead, { role: 'super_admin' });
    dialogConfirm.mockReturnValue({ afterClosed: () => of(true) });

    await fixture.componentInstance['confirmArchiveLead'](lead);

    expect(archiveLead).toHaveBeenCalledWith(lead.id);
  });

  it('restores an archived lead for a super admin', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      archivedAt: '2026-07-17T12:30:00.000Z',
    };
    const { fixture, restoreLead } = await render(lead, { role: 'super_admin' });

    await fixture.componentInstance['restoreLead'](lead);

    expect(restoreLead).toHaveBeenCalledWith(lead.id);
  });

  it('deletes an archived lead permanently after confirmation', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      archivedAt: '2026-07-17T12:30:00.000Z',
    };
    const { deleteLeadPermanently, dialogConfirm, fixture } = await render(lead, {
      role: 'super_admin',
    });
    dialogConfirm.mockReturnValue({ afterClosed: () => of(true) });

    await fixture.componentInstance['confirmDeleteLead'](lead);

    expect(deleteLeadPermanently).toHaveBeenCalledWith(lead.id);
  });

  it('shows archive to office admins of the lead office', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      clientStatus: 'closed_lost',
    };
    const { fixture } = await render(lead, {
      role: 'office_admin',
      userOffices: [{ code: 'warsaw' }],
    });
    const element = fixture.nativeElement as HTMLElement;
    const summary = element.querySelector('.terminal-summary') as HTMLElement | null;
    expect(summary).not.toBeNull();
    expect(findButton(summary!, 'Архівувати')).toBeTruthy();
  });

  it('shows manager editing only to a super admin and filters options by office', async () => {
    const lead = CRM_MOCK_LEADS[0]!;
    const { fixture } = await render(lead, { role: 'super_admin' });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.manager-card__edit')).not.toBeNull();
    const optionValues = fixture.componentInstance['managerOptions'](lead).map(
      (option) => option.value,
    );
    expect(optionValues).toContain('emp-kyiv-1');
    expect(optionValues).not.toContain('emp-warsaw-1');
    expect(optionValues).not.toContain('emp-kyiv-3');
    expect(optionValues).not.toContain('emp-super-admin');

    const memberView = await render(lead, { role: 'office_member' });
    expect(
      (memberView.fixture.nativeElement as HTMLElement).querySelector('.manager-card__edit'),
    ).toBeNull();
  });

  it('shows lead data editing to office users of an active lead', async () => {
    const lead = CRM_MOCK_LEADS[0]!;
    const superAdminView = await render(lead, { role: 'super_admin' });
    expect(
      (superAdminView.fixture.nativeElement as HTMLElement).querySelector('.lead-details__edit'),
    ).not.toBeNull();

    const officeAdminView = await render(lead, {
      role: 'office_admin',
      userOffices: [{ code: lead.officeCode }],
    });
    expect(
      (officeAdminView.fixture.nativeElement as HTMLElement).querySelector('.lead-details__edit'),
    ).not.toBeNull();

    const closedLeadView = await render(CRM_MOCK_LEADS[7]!, { role: 'super_admin' });
    expect(
      (closedLeadView.fixture.nativeElement as HTMLElement).querySelector('.lead-details__edit'),
    ).not.toBeNull();

    const wrongOfficeView = await render(lead, {
      role: 'office_admin',
      userOffices: [{ code: 'warsaw' }],
    });
    expect(
      (wrongOfficeView.fixture.nativeElement as HTMLElement).querySelector('.lead-details__edit'),
    ).toBeNull();

    const memberView = await render(lead, {
      role: 'office_member',
      userOffices: [{ code: lead.officeCode }],
    });
    expect(
      (memberView.fixture.nativeElement as HTMLElement).querySelector('.lead-details__edit'),
    ).not.toBeNull();

    const curatorView = await render(lead, {
      role: 'curator',
      userOffices: [{ code: lead.officeCode }],
    });
    expect(
      (curatorView.fixture.nativeElement as HTMLElement).querySelector('.lead-details__edit'),
    ).not.toBeNull();

    const memberWrongOfficeView = await render(lead, {
      role: 'office_member',
      userOffices: [{ code: 'warsaw' }],
    });
    expect(
      (memberWrongOfficeView.fixture.nativeElement as HTMLElement).querySelector(
        '.lead-details__edit',
      ),
    ).toBeNull();

    const archivedView = await render(
      { ...lead, archivedAt: '2026-07-23T10:00:00.000Z' },
      { role: 'super_admin' },
    );
    expect(
      (archivedView.fixture.nativeElement as HTMLElement).querySelector('.lead-details__edit'),
    ).toBeNull();
  });

  it('keeps archive hidden for office members even when they can edit lead data', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      clientStatus: 'closed_lost',
    };
    const { fixture } = await render(lead, {
      role: 'office_member',
      userOffices: [{ code: lead.officeCode }],
    });
    const element = fixture.nativeElement as HTMLElement;
    const summary = element.querySelector('.terminal-summary') as HTMLElement | null;
    expect(summary).not.toBeNull();
    expect(findButton(summary!, 'Архівувати')).toBeFalsy();
  });

  it('reloads the lead and emits changed after lead data is saved', async () => {
    const lead = CRM_MOCK_LEADS[0]!;
    const { fixture, getById } = await render(lead, { role: 'super_admin' });
    const changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);

    fixture.componentInstance['openLeadEditDialog'](lead);
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.css('app-edit-lead-dialog'));
    expect(dialog).not.toBeNull();

    dialog.componentInstance.saved.emit();

    await vi.waitFor(() => expect(getById).toHaveBeenCalledTimes(2));
    expect(changed).toHaveBeenCalledOnce();
    expect(fixture.componentInstance['editLeadDialogOpen']()).toBe(false);
  });

  it('assigns a manager through the existing lead details update contract', async () => {
    const lead: MockLead = { ...CRM_MOCK_LEADS[0]!, assignedToId: null };
    const updateLeadDetails = vi.fn(async () => undefined);
    const { fixture } = await render(lead, {
      role: 'super_admin',
      updateLeadDetails,
    });

    fixture.componentInstance['openAssignManagerDialog'](lead);
    fixture.componentInstance['assignManagerId'].set('emp-kyiv-1');
    await fixture.componentInstance['submitAssignManager'](lead);

    expect(updateLeadDetails).toHaveBeenCalledWith(
      lead.id,
      expect.objectContaining({ assignedToId: 'emp-kyiv-1' }),
      ['manager'],
    );
    expect(fixture.componentInstance['assignManagerDialogOpen']()).toBe(false);
  });

  it('opens the comment dialog and adds the submitted note', async () => {
    const lead = CRM_MOCK_LEADS[2]!;
    const { activities, dialogOpen, fixture } = await render(lead);
    const element = fixture.nativeElement as HTMLElement;
    dialogOpen.mockReturnValue({
      afterClosed: () =>
        of({
          comment: 'Узгодили повторний дзвінок.',
          dueDate: '2026-07-25',
          assignedTo: 'emp-kyiv-1',
        }),
    });

    findActionButton(element, 'Додати коментар')?.click();

    await vi.waitFor(() =>
      expect(activities.addComment).toHaveBeenCalledWith(
        lead.id,
        'Узгодили повторний дзвінок.',
        '2026-07-25',
        'emp-kyiv-1',
      ),
    );
    expect(dialogOpen.mock.calls[0]?.[1]?.data.title).toBe('Додати коментар');
    expect(dialogOpen.mock.calls[0]?.[1]?.data.allowDueDate).toBe(true);
    expect(dialogOpen.mock.calls[0]?.[1]?.data.allowManager).toBe(true);
    expect(dialogOpen.mock.calls[0]?.[1]?.data.managerOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '', label: expect.any(String) }),
        expect.objectContaining({ value: 'emp-kyiv-1', label: 'Данило Мороз' }),
      ]),
    );
    expect(
      dialogOpen.mock.calls[0]?.[1]?.data.managerOptions.some(
        (option: { value: string }) => option.value === 'emp-super-admin',
      ),
    ).toBe(false);
  });

  it('opens the call radial dialog and records the selected result', async () => {
    const lead = CRM_MOCK_LEADS[2]!;
    const { activities, dialogOpen, fixture } = await render(lead);
    const element = fixture.nativeElement as HTMLElement;
    dialogOpen.mockReturnValue({ afterClosed: () => of('no_answer') });

    findActionButton(element, 'Дзвінок')?.click();

    await vi.waitFor(() =>
      expect(activities.recordCall).toHaveBeenCalledWith(lead.id, 'no_answer', ''),
    );
    const config = dialogOpen.mock.calls[0]?.[1];
    expect(config?.panelClass).toBe('radial-menu-dialog-panel');
    expect(config?.data.actions).toHaveLength(3);
    expect(config?.data.actions.map((action: { tone: string }) => action.tone)).toEqual([
      'success',
      'danger',
      'brand',
    ]);
  });

  it('asks for a date when callback is selected and records it', async () => {
    const lead = CRM_MOCK_LEADS[2]!;
    const { activities, dialogOpen, fixture } = await render(lead);
    dialogOpen
      .mockReturnValueOnce({ afterClosed: () => of('callback_requested') })
      .mockReturnValueOnce({ afterClosed: () => of('2026-07-25') });

    findActionButton(fixture.nativeElement as HTMLElement, 'Дзвінок')?.click();

    await vi.waitFor(() =>
      expect(activities.recordCall).toHaveBeenCalledWith(
        lead.id,
        'callback_requested',
        '',
        '2026-07-25',
      ),
    );
    expect(dialogOpen.mock.calls[1]?.[1]).toMatchObject({
      data: { statusLabel: 'Передзвонити' },
      ariaLabelledBy: 'due-date-title',
    });
  });

  it('opens client statuses in the radial dialog and applies the selection', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[2]!,
      clientStatus: 'calculation_in_progress',
    };
    const { activities, dialogOpen, fixture } = await render(lead);
    dialogOpen.mockReturnValueOnce({ afterClosed: () => of('thinking') }).mockReturnValueOnce({
      afterClosed: () => of({ comment: 'Попросив час на рішення.', dueDate: '2026-07-28' }),
    });
    const element = fixture.nativeElement as HTMLElement;

    findActionButton(element, 'Статус клієнта')?.click();
    await vi.waitFor(() =>
      expect(activities.setClientStatus).toHaveBeenCalledWith(
        lead.id,
        'thinking',
        '2026-07-28',
        'Попросив час на рішення.',
      ),
    );

    const config = dialogOpen.mock.calls[0]?.[1];
    expect(config?.panelClass).toBe('radial-menu-dialog-panel');
    expect(config?.data.actions).toHaveLength(5);
    expect(config?.data.actions.map((action: { id: string }) => action.id)).toEqual([
      'showroom_invited',
      'calculation_in_progress',
      'thinking',
      'closed_lost',
      'contract_signed',
    ]);
    expect(config?.data.layout).toEqual({
      buttonAppearance: 'tone',
      anglesByActionId: {
        calculation_in_progress: -126,
        showroom_invited: -54,
        contract_signed: 18,
        thinking: 90,
        closed_lost: 162,
      },
    });
    expect(
      config?.data.actions.find((action: { id: string }) => action.id === 'calculation_in_progress')
        ?.disabled,
    ).toBe(true);
    const currentStatusTone = element
      .querySelector('.status-item--client .ui-badge')
      ?.className.match(/ui-badge--([\w-]+)/)?.[1];
    const radialStatusTone = config?.data.actions.find(
      (action: { id: string }) => action.id === lead.clientStatus,
    )?.tone;
    expect(radialStatusTone).toBe(currentStatusTone);
    expect(dialogOpen.mock.calls[1]?.[1]).toMatchObject({
      data: {
        eyebrow: 'Думає',
        title: 'Зафіксувати паузу',
        commentOptional: true,
        allowDueDate: true,
      },
      ariaLabelledBy: 'text-activity-title',
    });
  });

  it('allows reselecting showroom and prefills its optional date', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[2]!,
      clientStatus: 'showroom_invited',
      callbackDueAt: '2026-08-03T12:00:00.000Z',
      callbackDueContext: { category: 'client_status', statusCode: 'showroom_invited' },
    };
    const { activities, appointmentsList, dialogOpen, fixture } = await render(lead);
    dialogOpen
      .mockReturnValueOnce({ afterClosed: () => of('showroom_invited') })
      .mockReturnValueOnce({ afterClosed: () => of(undefined) });

    findActionButton(fixture.nativeElement as HTMLElement, 'Статус клієнта')?.click();

    await vi.waitFor(() => expect(appointmentsList).toHaveBeenCalledOnce());
    expect(activities.setClientStatus).not.toHaveBeenCalled();
    const radialConfig = dialogOpen.mock.calls[0]?.[1];
    expect(
      radialConfig?.data.actions.find((action: { id: string }) => action.id === 'showroom_invited')
        ?.disabled,
    ).toBe(false);
    expect(dialogOpen.mock.calls[1]?.[1]).toMatchObject({
      data: {
        lead: { id: lead.id },
        date: '2026-08-03',
      },
      position: { right: '0', top: '0' },
      height: '100dvh',
    });
  });

  it('links a scheduled showroom appointment to the calendar deep-link', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[2]!,
      clientStatus: 'showroom_invited',
      showroomDueAt: '2026-08-05T12:00:00.000Z',
    };
    const { fixture } = await render(lead);
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.status-item__appointment-link',
    );

    expect(link?.textContent).toContain('Відкрити в календарі');
    expect(link?.getAttribute('href')).toBe(
      `/crm/calendar?leadId=${lead.id}&date=2026-08-05&officeId=office-${lead.officeCode}`,
    );
  });
});
