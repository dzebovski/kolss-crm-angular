import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import { validateCloseLead } from '../../../services/crm-mock.helpers';
import type { MockLead, OfficeId } from '../../../services/crm-mock.types';
import { LeadWorkflowService } from '../../../services/lead-workflow.service';
import { LeadsService } from '../../../services/leads.service';
import { LossReasonsService } from '../../../services/loss-reasons.service';
import { UsersService } from '../../../services/users.service';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { LeadDetailPage } from './lead-detail-page';

interface LeadDetailHarness {
  readonly editLeadName: WritableSignal<string>;
  readonly editLeadPhone: WritableSignal<string>;
  readonly editLeadEmail: WritableSignal<string>;
  readonly editLeadCityRegion: WritableSignal<string>;
  readonly editLeadProductInterest: WritableSignal<string>;
  readonly editLeadBudget: WritableSignal<string>;
  readonly editLeadInitialMessage: WritableSignal<string>;
  readonly editLeadAssignedToId: WritableSignal<string>;
  readonly editHistoryType: WritableSignal<string>;
  readonly editHistoryComment: WritableSignal<string>;
  readonly closeReason: WritableSignal<string>;
  readonly closeComment: WritableSignal<string>;
  readonly editHistoryDialogOpen: WritableSignal<boolean>;
  readonly closeDialogOpen: WritableSignal<boolean>;
  readonly dialogError: WritableSignal<string>;
  openLeadEditDialog(lead: MockLead): void;
  submitLeadEdit(lead: MockLead): Promise<void>;
  openHistoryEditDialog(event: MockLead['events'][number]): void;
  submitHistoryEdit(lead: MockLead): Promise<void>;
  openEditCloseDialog(lead: MockLead): void;
  submitClose(lead: MockLead): Promise<void>;
}

describe('LeadDetailPage', () => {
  async function createLeadDetail(options?: {
    leadId?: string;
    getById?: (leadId: string) => Promise<MockLead | null>;
    role?: 'super_admin' | 'curator' | 'office_admin' | 'office_member';
    userOfficeCodes?: readonly OfficeId[];
    updateLeadDetails?: ReturnType<typeof vi.fn>;
    updateHistoryEvent?: ReturnType<typeof vi.fn>;
    updateCloseDetails?: ReturnType<typeof vi.fn>;
    archiveLead?: ReturnType<typeof vi.fn>;
    recordFirstCall?: ReturnType<typeof vi.fn>;
    takeLead?: ReturnType<typeof vi.fn>;
    dialogConfirm?: boolean;
  }) {
    const leadId = options?.leadId ?? 'lead-1007';
    const getById =
      options?.getById ??
      (async (requestedLeadId: string) =>
        CRM_MOCK_LEADS.find((lead) => lead.id === requestedLeadId) ?? null);
    const role = options?.role ?? 'super_admin';
    const userOfficeCodes = options?.userOfficeCodes ?? (['kyiv', 'warsaw'] as const);
    const updateLeadDetails = options?.updateLeadDetails ?? vi.fn(async () => undefined);
    const updateHistoryEvent = options?.updateHistoryEvent ?? vi.fn(async () => []);
    const updateCloseDetails = options?.updateCloseDetails ?? vi.fn(async () => null);
    const archiveLead = options?.archiveLead ?? vi.fn(async () => undefined);
    const recordFirstCall = options?.recordFirstCall ?? vi.fn(async () => null);
    const takeLead = options?.takeLead ?? vi.fn(async () => undefined);
    const dialogConfirm = options?.dialogConfirm ?? false;

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LeadDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ leadId }),
            },
          },
        },
        {
          provide: LeadsService,
          useValue: { getById, updateLeadDetails, updateHistoryEvent, updateCloseDetails, archiveLead },
        },
        {
          provide: UsersService,
          useValue: {
            listManagers: async () => [
              {
                id: 'emp-kyiv-1',
                displayName: 'Kyiv Manager',
                role: 'office_member',
                officeIds: ['kyiv'],
                status: 'active',
                createdAt: '2026-01-01T00:00:00.000Z',
                lastActiveAt: '2026-01-01T00:00:00.000Z',
              },
              {
                id: 'emp-warsaw-1',
                displayName: 'Warsaw Manager',
                role: 'office_member',
                officeIds: ['warsaw'],
                status: 'active',
                createdAt: '2026-01-01T00:00:00.000Z',
                lastActiveAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        },
        {
          provide: LeadWorkflowService,
          useValue: { recordFirstCall, takeLead },
        },
        {
          provide: LossReasonsService,
          useValue: {
            list: async () => [
              { code: 'no_contact', label_uk: 'Немає контакту', label_pl: 'Brak kontaktu' },
              { code: 'not_target', label_uk: 'Нецільовий', label_pl: 'Niecelowy' },
              { code: 'location_mismatch', label_uk: 'Не підходить місцеположення', label_pl: 'Lokalizacja' },
              { code: 'expensive', label_uk: 'Дорого', label_pl: 'Za drogo' },
              { code: 'lost_client', label_uk: 'Втрачений клієнт', label_pl: 'Utracony' },
              { code: 'price', label_uk: 'Не підійшла ціна', label_pl: 'Cena' },
            ],
          },
        },
        {
          provide: AuthService,
          useValue: {
            profile: () => ({
              id: 'admin-1',
              role,
              display_name: 'Admin User',
              is_active: true,
              deactivated_at: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            }),
          },
        },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            officeContext: () => ({
              isSuperAdmin: role === 'super_admin',
              canFilter: role === 'super_admin' || role === 'curator',
              canUseOfficeFilter: false,
              offices: [],
              filterOffices: [],
              userOffices: userOfficeCodes.map((code) => ({
                id: `office-${code}`,
                code,
                name_uk: code,
                name_pl: code,
                is_active: true,
              })),
            }),
          },
        },
        {
          provide: UiDialogService,
          useValue: {
            confirm: () => ({ afterClosed: () => of(dialogConfirm) }),
          },
        },
      ],
    }).compileComponents();

    return TestBed.createComponent(LeadDetailPage);
  }

  it('shows loading skeleton while the lead request is pending', async () => {
    let resolveLead!: (lead: MockLead | null) => void;
    const pendingLead = new Promise<MockLead | null>((resolve) => {
      resolveLead = resolve;
    });
    const fixture = await createLeadDetail({ getById: () => pendingLead });

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.lead-page--loading')).toBeTruthy();
    expect(element.querySelector('.skeleton-panel')).toBeTruthy();
    expect(element.textContent).not.toContain('Лід не знайдено');

    resolveLead(CRM_MOCK_LEADS[0] ?? null);
    await fixture.whenStable();
  });

  it('renders missing state only after loading resolves with no lead', async () => {
    const fixture = await createLeadDetail({
      leadId: 'missing-lead',
      getById: async () => null,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.lead-page--loading')).toBeFalsy();
    expect(element.textContent).toContain('Лід не знайдено');
    expect(element.textContent).toContain('Повернутись до списку');
  });

  it('renders successful terminal state for a converted lead', async () => {
    const fixture = await createLeadDetail();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Катерина Савчук');
    expect(element.textContent).toContain('Лід успішно завершено');
    expect(element.textContent).toContain('K-KY-2026-0618');
  });

  it('renders a date picker for scheduling visits', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1001' });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('input[type="date"]')).toBeTruthy();
    expect(element.textContent).toContain('Дата');
  });

  it('shows edit controls only for admins in scope', async () => {
    const superAdminFixture = await createLeadDetail({ leadId: 'lead-1001', role: 'super_admin' });
    await superAdminFixture.whenStable();
    superAdminFixture.detectChanges();
    await superAdminFixture.whenStable();

    expect((superAdminFixture.nativeElement as HTMLElement).textContent).toContain('Редагувати');

    const officeAdminFixture = await createLeadDetail({
      leadId: 'lead-1001',
      role: 'office_admin',
      userOfficeCodes: ['warsaw'],
    });
    await officeAdminFixture.whenStable();
    officeAdminFixture.detectChanges();
    await officeAdminFixture.whenStable();

    expect((officeAdminFixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Редагувати',
    );

    const memberFixture = await createLeadDetail({ leadId: 'lead-1001', role: 'office_member' });
    await memberFixture.whenStable();
    memberFixture.detectChanges();
    await memberFixture.whenStable();

    expect((memberFixture.nativeElement as HTMLElement).textContent).not.toContain('Редагувати');
  });

  it('submits lead detail and manager edits with audit field labels', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const updateLeadDetails = vi.fn(async () => undefined);
    const fixture = await createLeadDetail({ leadId: lead.id, updateLeadDetails });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const harness = fixture.componentInstance as unknown as LeadDetailHarness;
    harness.openLeadEditDialog(lead);
    harness.editLeadPhone.set('+380 67 000 00 00');
    harness.editLeadAssignedToId.set('emp-kyiv-1');

    await harness.submitLeadEdit(lead);

    expect(updateLeadDetails).toHaveBeenCalledWith(
      lead.id,
      expect.objectContaining({
        phone: '+38 067 0000000',
        assignedToId: 'emp-kyiv-1',
      }),
      expect.arrayContaining(['phone', 'manager']),
    );
  });

  it('submits history edits without changing the original event date', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const event = lead.events[0]!;
    const updateHistoryEvent = vi.fn(async () => ['message', 'type']);
    const fixture = await createLeadDetail({ leadId: lead.id, updateHistoryEvent });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const harness = fixture.componentInstance as unknown as LeadDetailHarness;
    harness.openHistoryEditDialog(event);
    harness.editHistoryType.set('comment');
    harness.editHistoryComment.set('Оновлений текст історії');

    await harness.submitHistoryEdit(lead);

    expect(updateHistoryEvent).toHaveBeenCalledWith(lead.id, event.id, {
      eventType: 'comment',
      comment: 'Оновлений текст історії',
    });
  });

  it('shows no-op error when history edit has no changes', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const event = lead.events[0]!;
    const updateHistoryEvent = vi.fn(async () => {
      throw new Error('Нічого не змінено');
    });
    const fixture = await createLeadDetail({ leadId: lead.id, updateHistoryEvent });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const harness = fixture.componentInstance as unknown as LeadDetailHarness;
    harness.openHistoryEditDialog(event);
    harness.editHistoryComment.set(event.comment ?? '');

    await harness.submitHistoryEdit(lead);
    fixture.detectChanges();

    expect(harness.editHistoryDialogOpen()).toBe(true);
    expect(harness.dialogError()).toBe('Нічого не змінено');
  });

  it('shows access error when history edit update is blocked', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const event = lead.events[0]!;
    const updateHistoryEvent = vi.fn(async () => {
      throw new Error('Не вдалося зберегти подію. Перевірте права доступу.');
    });
    const fixture = await createLeadDetail({ leadId: lead.id, updateHistoryEvent });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const harness = fixture.componentInstance as unknown as LeadDetailHarness;
    harness.openHistoryEditDialog(event);
    harness.editHistoryComment.set('Новий текст');

    await harness.submitHistoryEdit(lead);
    fixture.detectChanges();

    expect(harness.editHistoryDialogOpen()).toBe(true);
    expect(harness.dialogError()).toContain('права доступу');
  });

  it('shows edit close reason button on closed lead banner', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1008', role: 'office_member' });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Лід закрито');
    expect(element.textContent).toContain('Редагувати');
  });

  it('shows archive for super admin on closed lead', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1008', role: 'super_admin' });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Архівувати');
  });

  it('hides archive for office member on closed lead', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1008', role: 'office_member' });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('Архівувати');
  });

  it('archives closed lead after confirmation', async () => {
    const archiveLead = vi.fn(async () => undefined);
    const fixture = await createLeadDetail({
      leadId: 'lead-1008',
      role: 'super_admin',
      archiveLead,
      dialogConfirm: true,
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1008')!;
    await fixture.componentInstance['confirmArchiveLead'](lead);

    expect(archiveLead).toHaveBeenCalledWith('lead-1008');
    expect(navigateSpy).toHaveBeenCalledWith(['/crm/leads']);
  });

  it('submits close reason edits through updateCloseDetails', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1008')!;
    const updateCloseDetails = vi.fn(async () => null);
    const fixture = await createLeadDetail({ leadId: lead.id, updateCloseDetails });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const harness = fixture.componentInstance as unknown as LeadDetailHarness;
    harness.openEditCloseDialog(lead);
    harness.closeReason.set('lost_client');
    harness.closeComment.set('Клієнт обрав іншого постачальника');

    await harness.submitClose(lead);

    expect(updateCloseDetails).toHaveBeenCalledWith(lead.id, {
      reason: 'lost_client',
      comment: 'Клієнт обрав іншого постачальника',
    });
    expect(harness.closeDialogOpen()).toBe(false);
  });

  it('validates lost_client close reason edit without comment', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1009')!;
    const updateCloseDetails = vi.fn(async (_leadId, payload) => validateCloseLead(payload));
    const fixture = await createLeadDetail({ leadId: lead.id, updateCloseDetails });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const harness = fixture.componentInstance as unknown as LeadDetailHarness;
    harness.openEditCloseDialog(lead);
    harness.closeReason.set('lost_client');
    harness.closeComment.set('');

    await harness.submitClose(lead);
    fixture.detectChanges();

    expect(updateCloseDetails).toHaveBeenCalled();
    expect(harness.closeDialogOpen()).toBe(true);
    expect(harness.dialogError()).toContain('validation.lostClientComment');
  });

  it('renders history edit audit for regular users', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const auditedLead: MockLead = {
      ...lead,
      events: [
        {
          ...lead.events[0]!,
          rawType: 'comment',
          editAudit: {
            fields: ['message', 'type'],
            editedAt: '2026-07-07T17:30:00.000Z',
            editedById: 'admin-1',
            editedByName: 'Admin User',
          },
        },
      ],
    };
    const fixture = await createLeadDetail({
      leadId: auditedLead.id,
      role: 'office_member',
      getById: async () => auditedLead,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Відредаговано: повідомлення, тип');
    expect(element.textContent).toContain('Редагував: Admin User');
    expect(element.textContent).not.toContain('Редагувати');
  });

  it('auto-takes lead after first call when unassigned', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    expect(lead.assignedToId).toBeNull();
    const recordFirstCall = vi.fn(async () => null);
    const takeLead = vi.fn(async () => undefined);
    const fixture = await createLeadDetail({
      leadId: lead.id,
      role: 'office_member',
      recordFirstCall,
      takeLead,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance['saveFirstCall'](lead);

    expect(recordFirstCall).toHaveBeenCalledWith(lead.id, expect.any(String), expect.any(String));
    expect(takeLead).toHaveBeenCalledWith(lead.id);
  });

  it('does not auto-take after first call when already assigned', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1003')!;
    expect(lead.assignedToId).toBeTruthy();
    const recordFirstCall = vi.fn(async () => null);
    const takeLead = vi.fn(async () => undefined);
    const uncalledLead: MockLead = {
      ...lead,
      firstCall: null,
      workflowStatus: 'taken',
    };
    const fixture = await createLeadDetail({
      leadId: uncalledLead.id,
      role: 'office_member',
      getById: async () => uncalledLead,
      recordFirstCall,
      takeLead,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance['saveFirstCall'](uncalledLead);

    expect(recordFirstCall).toHaveBeenCalled();
    expect(takeLead).not.toHaveBeenCalled();
  });

  it('keeps take in work enabled when lead already has a manager', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1003', role: 'office_member' });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(element.querySelectorAll('app-ui-button button'));
    const takeButton = buttons.find((button) => button.textContent?.includes('Взяти в роботу')) as
      | HTMLButtonElement
      | undefined;
    expect(takeButton).toBeTruthy();
    expect(takeButton!.disabled).toBe(false);
  });

  it('shows assign manager control for super admin on unassigned lead', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1001', role: 'super_admin' });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Призначити менеджера');
  });

  it('shows replace manager control for super admin on assigned lead', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1003', role: 'super_admin' });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Замінити менеджера');
    expect(element.textContent).not.toContain('Призначити менеджера');
  });

  it('submits super-admin manager assignment via updateLeadDetails', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const updateLeadDetails = vi.fn(async () => undefined);
    const fixture = await createLeadDetail({
      leadId: lead.id,
      role: 'super_admin',
      updateLeadDetails,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance['openAssignManagerDialog'](lead);
    fixture.componentInstance['assignManagerId'].set('emp-kyiv-1');
    await fixture.componentInstance['submitAssignManager'](lead);

    expect(updateLeadDetails).toHaveBeenCalledWith(
      lead.id,
      expect.objectContaining({ assignedToId: 'emp-kyiv-1' }),
      ['manager'],
    );
  });

  it('hides lead_edited events from the timeline and events count', async () => {
    const base = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const lead: MockLead = {
      ...base,
      events: [
        {
          id: 'evt-visible',
          type: 'created',
          rawType: 'created',
          comment: 'Created from site',
          newValue: null,
          actorId: 'emp-super-admin',
          actorName: 'Platform Admin',
          occurredAt: '2026-07-06T11:24:00.000Z',
        },
        {
          id: 'evt-hidden-edited',
          type: 'lead_updated',
          rawType: 'lead_edited',
          comment: null,
          newValue: null,
          actorId: 'emp-kyiv-1',
          actorName: 'Kyiv Manager',
          occurredAt: '2026-07-06T12:00:00.000Z',
        },
        {
          id: 'evt-hidden-updated',
          type: 'lead_updated',
          rawType: 'lead_updated',
          comment: null,
          newValue: null,
          actorId: 'emp-kyiv-1',
          occurredAt: '2026-07-06T12:30:00.000Z',
        },
        {
          id: 'evt-comment',
          type: 'comment',
          rawType: 'comment',
          comment: 'Follow-up note',
          newValue: null,
          actorId: 'emp-kyiv-1',
          occurredAt: '2026-07-06T13:00:00.000Z',
        },
      ],
    };
    const fixture = await createLeadDetail({
      leadId: lead.id,
      getById: async () => lead,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('2 подій');
    expect(fixture.componentInstance['timelineEvents']()).toHaveLength(2);
    expect(fixture.componentInstance['timelineEvents']().map((e) => e.id)).toEqual([
      'evt-visible',
      'evt-comment',
    ]);
    expect(element.textContent).toContain('Platform Admin');
    expect(element.textContent).not.toContain('lead_edited');
  });

  it('uses event actorName when managers list does not include the actor', async () => {
    const base = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const lead: MockLead = {
      ...base,
      events: [
        {
          id: 'evt-created-by-admin',
          type: 'created',
          rawType: 'created',
          comment: null,
          newValue: null,
          actorId: 'emp-super-admin',
          actorName: 'Platform Super Admin',
          occurredAt: '2026-07-06T11:24:00.000Z',
        },
      ],
    };
    const fixture = await createLeadDetail({
      leadId: lead.id,
      getById: async () => lead,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Platform Super Admin');
    expect(element.textContent).not.toContain('Непризначено');
  });

  it('omits lead_updated and lead_edited from history edit type options', async () => {
    const fixture = await createLeadDetail({ leadId: 'lead-1001' });
    await fixture.whenStable();
    fixture.detectChanges();

    const values = fixture.componentInstance['historyEventTypeOptions']().map((o) => o.value);
    expect(values).not.toContain('lead_updated');
    expect(values).not.toContain('lead_edited');
  });
});
