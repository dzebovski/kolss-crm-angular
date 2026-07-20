import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import { AuthService } from '../core/auth/auth.service';
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
});
