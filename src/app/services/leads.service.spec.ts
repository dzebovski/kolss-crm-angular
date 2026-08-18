import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '@core/api/generated/kolss-api.client';
import { AuthService } from '@core/auth/auth.service';
import { LeadsService } from './leads.service';
import type { LeadListRow } from './leads.mapper';

const row: LeadListRow = {
  id: 'lead-1',
  office_id: 'office-1',
  source_system: 'manual',
  external_lead_id: 'crm:1',
  lead_status: 'new',
  lead_status_changed_at: null,
  workflow_status: 'new',
  workflow_status_changed_at: null,
  call_status: null,
  call_status_changed_at: null,
  client_status: 'new_lead',
  client_status_changed_at: '2026-07-10T00:00:00Z',
  assigned_to: null,
  loss_reason: null,
  converted_project_id: null,
  estimated_budget: null,
  our_quote: null,
  callback_due_at: null,
  source_channel: 'office',
  source_note: null,
  next_task_due_at: null,
  next_task_title: null,
  last_comment: null,
  last_comment_at: null,
  name: 'Test',
  phone: '+380501112233',
  email: null,
  product_interest: null,
  order_comment: null,
  city_region: null,
  project_stage_source: null,
  source_created_at: null,
  created_at: '2026-07-10T00:00:00Z',
  updated_at: '2026-07-10T00:00:00Z',
  offices: { id: 'office-1', code: 'kyiv', name_uk: 'Київ', name_pl: 'Kijów', is_active: true },
};

describe('LeadsService', () => {
  function setup(api: Partial<KolssApiClient>) {
    TestBed.configureTestingModule({
      providers: [
        LeadsService,
        { provide: KolssApiClient, useValue: api },
        { provide: AuthService, useValue: { sessionContext: () => null } },
      ],
    });
    return TestBed.inject(LeadsService);
  }

  it('creates a lead through Go API', async () => {
    const createLead = vi.fn().mockResolvedValue(row);
    const service = setup({ createLead } as Partial<KolssApiClient>);
    const result = await service.createLead({
      officeId: 'office-1',
      source: 'office',
      name: 'Test',
      phone: '+380501112233',
      email: null,
      cityRegion: '',
      productInterest: '',
      estimatedBudget: null,
      initialMessage: '',
      sourceCreatedAtLocal: '2026-07-10T12:00',
    });
    expect(result.id).toBe('lead-1');
    expect(createLead).toHaveBeenCalledOnce();
  });

  it('archives instead of deleting a lead', async () => {
    const archiveLead = vi.fn().mockResolvedValue(undefined);
    const service = setup({ archiveLead } as Partial<KolssApiClient>);
    await service.archiveLead('lead-1');
    expect(archiveLead).toHaveBeenCalledWith('lead-1');
  });

  it('sets and removes a shared lead marker through the API', async () => {
    const setLeadMarker = vi.fn().mockResolvedValue({
      kind: 'manager_aware',
      actor_id: 'user-1',
      actor_name: 'Олена',
      marked_at: '2026-07-17T12:00:00.000Z',
    });
    const deleteLeadMarker = vi.fn().mockResolvedValue(undefined);
    const service = setup({ setLeadMarker, deleteLeadMarker } as Partial<KolssApiClient>);

    await expect(service.setMarker('lead-1', 'manager_aware')).resolves.toEqual({
      kind: 'manager_aware',
      actorId: 'user-1',
      actorName: 'Олена',
      markedAt: '2026-07-17T12:00:00.000Z',
    });
    await service.deleteMarker('lead-1', 'manager_aware');

    expect(setLeadMarker).toHaveBeenCalledWith('lead-1', 'manager_aware');
    expect(deleteLeadMarker).toHaveBeenCalledWith('lead-1', 'manager_aware');
  });

  it('requests and returns a timeline event translation through the API', async () => {
    const response = {
      translation: 'The client confirmed the measurements.',
      sourceLanguage: 'UK' as const,
      translatedAt: '2026-07-20T12:00:00.000Z',
    };
    const translateEvent = vi.fn().mockResolvedValue(response);
    const service = setup({ translateEvent } as Partial<KolssApiClient>);

    await expect(service.translateHistoryEvent('lead-1', 'event-1')).resolves.toEqual(response);
    expect(translateEvent).toHaveBeenCalledWith('lead-1', 'event-1');
  });

  describe('list() pagination', () => {
    function makeRows(prefix: string, count: number): LeadListRow[] {
      return Array.from({ length: count }, (_, i) => ({ ...row, id: `${prefix}-${i}` }));
    }

    it('walks every cursor page when no limit is given, instead of stopping short', async () => {
      // Mirrors the shape of the real Kyiv office count (255 active leads):
      // three pages of 100/100/55 rather than stopping at an arbitrary cap.
      const listLeads = vi.fn(async ({ cursor }: { cursor: string }) => {
        if (cursor === '') return { items: makeRows('p1', 100), nextCursor: 'c1' };
        if (cursor === 'c1') return { items: makeRows('p2', 100), nextCursor: 'c2' };
        return { items: makeRows('p3', 55), nextCursor: '' };
      });
      const service = setup({ listLeads } as Partial<KolssApiClient>);

      const result = await service.list({ officeId: 'office-1', archived: 'active' });

      expect(result).toHaveLength(255);
      expect(listLeads).toHaveBeenCalledTimes(3);
      expect(listLeads).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ cursor: '', limit: 100 }),
      );
      expect(listLeads).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ cursor: 'c2', limit: 100 }),
      );
    });

    it('stops at an explicit limit instead of paging through everything', async () => {
      const listLeads = vi
        .fn()
        .mockResolvedValue({ items: makeRows('p', 100), nextCursor: 'more' });
      const service = setup({ listLeads } as Partial<KolssApiClient>);

      const result = await service.list({ officeId: 'office-1', limit: 120 });

      expect(result).toHaveLength(120);
      expect(listLeads).toHaveBeenCalledTimes(2);
      expect(listLeads).toHaveBeenNthCalledWith(2, expect.objectContaining({ limit: 20 }));
    });

    it('fails loudly instead of silently truncating when an unbounded fetch runs away', async () => {
      let page = 0;
      const listLeads = vi.fn(async () => {
        page += 1;
        return { items: makeRows(`r${page}`, 100), nextCursor: `c${page}` };
      });
      const service = setup({ listLeads } as Partial<KolssApiClient>);

      await expect(service.list({ officeId: 'office-1' })).rejects.toThrow(/safety limit/);
    });
  });
});
