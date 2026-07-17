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
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { UiUser } from '../../../ui/user/ui-user';
import { LeadDetailPage } from './lead-detail-page';

describe('LeadDetailPage', () => {
  async function render(
    lead: MockLead,
    options: {
      role?: UserRole;
      managers?: typeof CRM_MOCK_EMPLOYEES;
      updateLeadDetails?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    TestBed.resetTestingModule();
    const updateLeadDetails = options.updateLeadDetails ?? vi.fn(async () => undefined);
    const activities = {
      recordCall: vi.fn(),
      addComment: vi.fn(),
      setClientStatus: vi.fn(),
      closeLead: vi.fn(),
      signContract: vi.fn(),
      reopen: vi.fn(),
    };
    const dialogOpen = vi.fn();
    await TestBed.configureTestingModule({
      imports: [LeadDetailPage],
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
          useValue: { getById: async () => lead, updateLeadDetails },
        },
        { provide: LeadActivitiesService, useValue: activities },
        {
          provide: UsersService,
          useValue: { listManagers: async () => options.managers ?? CRM_MOCK_EMPLOYEES },
        },
        { provide: UiDialogService, useValue: { open: dialogOpen } },
        {
          provide: SessionService,
          useValue: { locale: () => 'uk' },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LeadDetailPage);
    await fixture.whenStable();
    return { activities, dialogOpen, fixture, updateLeadDetails };
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
        newValue: null,
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

  it('has no automated accessibility violations in the timeline', async () => {
    const { fixture } = await render(CRM_MOCK_LEADS[2]!);
    const timeline = (fixture.nativeElement as HTMLElement).querySelector(
      '.timeline-panel',
    ) as HTMLElement;

    expect((await axe.run(timeline)).violations).toEqual([]);
  });

  it('blocks ordinary actions for a terminal lead and offers reopen', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      clientStatus: 'closed_lost',
    };
    const { fixture } = await render(lead, { role: 'super_admin' });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Перевідкрити');
    expect(element.querySelector('.lead-actions')).toBeNull();
    expect(element.querySelector('.terminal-note')).not.toBeNull();
    expect(element.querySelector('.manager-card__edit')).not.toBeNull();
  });

  it('keeps an archived lead read-only without offering reopen', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[7]!,
      archivedAt: '2026-07-17T12:30:00.000Z',
    };
    const { fixture } = await render(lead, { role: 'super_admin' });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.lead-actions')).toBeNull();
    expect(element.querySelector('.manager-card__edit')).toBeNull();
    expect(element.textContent).toContain('Архівна заявка доступна лише для перегляду');
    expect(element.textContent).not.toContain('Перевідкрити');
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
    dialogOpen.mockReturnValue({ afterClosed: () => of('Узгодили повторний дзвінок.') });

    findActionButton(element, 'Додати коментар')?.click();

    await vi.waitFor(() =>
      expect(activities.addComment).toHaveBeenCalledWith(lead.id, 'Узгодили повторний дзвінок.'),
    );
    expect(dialogOpen.mock.calls[0]?.[1]?.data.title).toBe('Додати коментар');
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

  it('opens client statuses in the radial dialog and applies the selection', async () => {
    const lead: MockLead = {
      ...CRM_MOCK_LEADS[2]!,
      clientStatus: 'calculation_in_progress',
    };
    const { activities, dialogOpen, fixture } = await render(lead);
    dialogOpen.mockReturnValue({ afterClosed: () => of('thinking') });
    const element = fixture.nativeElement as HTMLElement;

    findActionButton(element, 'Статус клієнта')?.click();
    await vi.waitFor(() =>
      expect(activities.setClientStatus).toHaveBeenCalledWith(lead.id, 'thinking'),
    );

    const config = dialogOpen.mock.calls[0]?.[1];
    expect(config?.panelClass).toBe('radial-menu-dialog-panel');
    expect(config?.data.actions).toHaveLength(5);
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
  });
});
