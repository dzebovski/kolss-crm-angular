import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { MockLead, OfficeId } from '../../../services/crm-mock.types';
import { LeadWorkflowService } from '../../../services/lead-workflow.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
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
  openLeadEditDialog(lead: MockLead): void;
  submitLeadEdit(lead: MockLead): Promise<void>;
  openHistoryEditDialog(event: MockLead['events'][number]): void;
  submitHistoryEdit(lead: MockLead): Promise<void>;
}

describe('LeadDetailPage', () => {
  async function createLeadDetail(options?: {
    leadId?: string;
    getById?: (leadId: string) => Promise<MockLead | null>;
    role?: 'super_admin' | 'curator' | 'office_admin' | 'office_member';
    userOfficeCodes?: readonly OfficeId[];
    updateLeadDetails?: ReturnType<typeof vi.fn>;
    updateHistoryEvent?: ReturnType<typeof vi.fn>;
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
          useValue: { getById, updateLeadDetails, updateHistoryEvent },
        },
        {
          provide: UsersService,
          useValue: {
            listEmployees: async () => [
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
          useValue: {},
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
        phone: '+380 67 000 00 00',
        assignedToId: 'emp-kyiv-1',
      }),
      expect.arrayContaining(['телефон', 'менеджер']),
    );
  });

  it('submits history edits without changing the original event date', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const event = lead.events[0]!;
    const updateHistoryEvent = vi.fn(async () => ['повідомлення', 'тип']);
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

  it('renders history edit audit for regular users', async () => {
    const lead = CRM_MOCK_LEADS.find((item) => item.id === 'lead-1001')!;
    const auditedLead: MockLead = {
      ...lead,
      events: [
        {
          ...lead.events[0]!,
          rawType: 'comment',
          editAudit: {
            fields: ['повідомлення', 'тип'],
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
});
