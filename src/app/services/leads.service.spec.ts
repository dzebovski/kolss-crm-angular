import { TestBed } from '@angular/core/testing';

import { AuthService } from '../core/auth/auth.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import { LeadsService } from './leads.service';

describe('LeadsService.createLead', () => {
  function setup() {
    const leadEventsInsert = vi.fn().mockResolvedValue({ error: null });
    const leadsSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'lead-new-1',
        name: 'Тест Клієнт',
        phone: '+380501112233',
        email: null,
        lead_status: 'new',
        workflow_status: 'new',
        office_id: 'office-kyiv',
        assigned_to: null,
        source_created_at: '2026-07-09T12:00:00.000Z',
        created_at: '2026-07-09T12:00:00.000Z',
        updated_at: '2026-07-09T12:00:00.000Z',
        last_comment: null,
        callback_due_at: null,
        source_system: 'manual',
        source_channel: 'office',
        source_note: null,
        product_interest: null,
        estimated_budget: null,
        city_region: null,
        order_comment: null,
        offices: { id: 'office-kyiv', code: 'kyiv', name_uk: 'Київ', name_pl: 'Kijów', is_active: true },
        profiles: null,
      },
      error: null,
    });
    const leadsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: leadsSingle }),
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'leads') return { insert: leadsInsert };
        if (table === 'lead_events') return { insert: leadEventsInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        LeadsService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabase },
        },
        {
          provide: AuthService,
          useValue: {
            sessionContext: () => ({
              user: { id: 'user-1', email: 'manager@example.com' },
              profile: { display_name: 'Менеджер' },
            }),
          },
        },
      ],
    });

    return {
      service: TestBed.inject(LeadsService),
      leadsInsert,
      leadEventsInsert,
    };
  }

  it('inserts lead and created event with mapped source fields', async () => {
    const { service, leadsInsert, leadEventsInsert } = setup();

    const lead = await service.createLead({
      officeId: 'office-kyiv',
      source: 'office',
      name: 'Тест Клієнт',
      phone: '+380501112233',
      email: null,
      cityRegion: 'Київ',
      productInterest: 'Кухня',
      estimatedBudget: 12000,
      initialMessage: 'Потрібна консультація',
    });

    expect(lead.id).toBe('lead-new-1');
    expect(leadsInsert).toHaveBeenCalledTimes(1);
    const insertPayload = leadsInsert.mock.calls[0][0];
    expect(insertPayload.office_id).toBe('office-kyiv');
    expect(insertPayload.source_system).toBe('manual');
    expect(insertPayload.source_channel).toBe('office');
    expect(insertPayload.external_lead_id).toMatch(/^crm:/);
    expect(insertPayload.name).toBe('Тест Клієнт');

    expect(leadEventsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: 'lead-new-1',
        actor_id: 'user-1',
        event_type: 'created',
      }),
    );
  });
});

describe('LeadsService.deleteLead', () => {
  it('deletes lead by id', async () => {
    const leadsDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'lead-1' }, error: null }),
        }),
      }),
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'leads') return { delete: leadsDelete };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        LeadsService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => supabase },
        },
        {
          provide: AuthService,
          useValue: {
            sessionContext: () => ({
              user: { id: 'user-1', email: 'admin@example.com' },
              profile: { display_name: 'Admin' },
            }),
          },
        },
      ],
    });

    const service = TestBed.inject(LeadsService);
    await service.deleteLead('lead-1');

    expect(leadsDelete).toHaveBeenCalled();
    const deleteChain = leadsDelete.mock.results[0]?.value;
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'lead-1');
    expect(deleteChain.eq.mock.results[0]?.value.select).toHaveBeenCalledWith('id');
  });
});
