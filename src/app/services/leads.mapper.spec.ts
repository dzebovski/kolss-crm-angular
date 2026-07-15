import {
  mapCreateLeadSource,
  mapLeadDetail,
  mapLeadListRow,
  type LeadListRow,
} from './leads.mapper';
import type { LeadSource } from './crm-mock.types';

const baseRow: LeadListRow = {
  id: 'lead-1',
  office_id: 'office-1',
  source_system: 'manual',
  external_lead_id: 'crm:1',
  lead_status: 'new',
  lead_status_changed_at: null,
  workflow_status: 'new',
  workflow_status_changed_at: null,
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

describe('mapCreateLeadSource', () => {
  it.each<[LeadSource, string]>([
    ['office', 'office'],
    ['website', 'website'],
    ['facebook', 'facebook'],
    ['other', 'other'],
  ])('maps %s to manual/%s', (source, channel) => {
    expect(mapCreateLeadSource(source)).toEqual({
      source_system: 'manual',
      source_channel: channel,
    });
  });
});

describe('mapLeadListRow first_contact_attempt', () => {
  it('maps embedded attempt to firstCall', () => {
    const lead = mapLeadListRow({
      ...baseRow,
      first_contact_attempt: {
        result: 'reached',
        comment: 'Клієнт планує замір після вихідних.',
        created_at: '2026-07-01T16:10:00.000Z',
        manager_id: 'emp-kyiv-1',
      },
    });

    expect(lead.firstCall).toEqual({
      date: '2026-07-01T16:10:00.000Z',
      result: 'reached',
      comment: 'Клієнт планує замір після вихідних.',
    });
    expect(lead.firstManagerId).toBe('emp-kyiv-1');
  });

  it('sets firstCall to null when attempt is missing', () => {
    expect(mapLeadListRow(baseRow).firstCall).toBeNull();
    expect(mapLeadListRow({ ...baseRow, first_contact_attempt: null }).firstCall).toBeNull();
  });

  it('formats Ukrainian phone to +38 XXX XXXXXXX', () => {
    expect(mapLeadListRow(baseRow).phone).toBe('+38 050 1112233');
    expect(
      mapLeadListRow({
        ...baseRow,
        phone: '+380 67 214 88 19',
      }).phone,
    ).toBe('+38 067 2148819');
  });

  it('formats Warsaw phone to +48 XXX XXX XXX', () => {
    expect(
      mapLeadListRow({
        ...baseRow,
        phone: '501223118',
        offices: {
          id: 'office-warsaw',
          code: 'warsaw',
          name_uk: 'Варшава',
          name_pl: 'Warszawa',
          is_active: true,
        },
      }).phone,
    ).toBe('+48 501 223 118');
  });
});

describe('mapLeadListRow close', () => {
  it('builds close from list row without events using workflow timestamp', () => {
    const lead = mapLeadListRow({
      ...baseRow,
      workflow_status: 'closed',
      loss_reason: 'expensive',
      last_comment: 'Після пояснення бюджету клієнт відмовився.',
      workflow_status_changed_at: '2026-05-30T09:05:00.000Z',
      last_comment_at: '2026-05-30T09:00:00.000Z',
      updated_at: '2026-05-30T09:10:00.000Z',
    });

    expect(lead.close).toEqual({
      reason: 'expensive',
      comment: 'Після пояснення бюджету клієнт відмовився.',
      closedAt: '2026-05-30T09:05:00.000Z',
      actorId: '',
    });
  });

  it('falls back to last_comment_at then updated_at for closedAt', () => {
    expect(
      mapLeadListRow({
        ...baseRow,
        workflow_status: 'closed',
        loss_reason: 'no_contact',
        last_comment: null,
        workflow_status_changed_at: null,
        last_comment_at: '2026-04-21T10:00:00.000Z',
        updated_at: '2026-04-21T11:00:00.000Z',
      }).close?.closedAt,
    ).toBe('2026-04-21T10:00:00.000Z');

    expect(
      mapLeadListRow({
        ...baseRow,
        workflow_status: 'closed',
        loss_reason: 'spam',
        last_comment: null,
        workflow_status_changed_at: null,
        last_comment_at: null,
        updated_at: '2026-04-21T11:00:00.000Z',
      }).close?.closedAt,
    ).toBe('2026-04-21T11:00:00.000Z');
  });

  it('prefers close event created_at when present', () => {
    const lead = mapLeadDetail(
      {
        ...baseRow,
        workflow_status: 'closed',
        loss_reason: 'expensive',
        last_comment: 'Row comment',
        workflow_status_changed_at: '2026-05-30T09:05:00.000Z',
      },
      {
        contactAttempts: [],
        showroomVisits: [],
        contracts: [],
        events: [
          {
            id: 'evt-closed',
            lead_id: 'lead-1',
            actor_id: 'emp-1',
            event_type: 'closed',
            comment: 'Event comment',
            old_value: null,
            new_value: null,
            created_at: '2026-05-30T08:00:00.000Z',
            profiles: null,
          },
        ],
      },
    );

    expect(lead.close?.closedAt).toBe('2026-05-30T08:00:00.000Z');
    expect(lead.close?.actorId).toBe('emp-1');
  });
});

describe('mapLeadDetail events', () => {
  it('maps profiles.display_name to actorName and lead_edited to lead_updated', () => {
    const lead = mapLeadDetail(baseRow, {
      contactAttempts: [],
      showroomVisits: [],
      contracts: [],
      events: [
        {
          id: 'evt-created',
          lead_id: 'lead-1',
          actor_id: 'user-super',
          event_type: 'created',
          comment: null,
          old_value: null,
          new_value: null,
          created_at: '2026-07-10T00:00:00Z',
          profiles: { display_name: '  Super Admin  ' },
        },
        {
          id: 'evt-edited',
          lead_id: 'lead-1',
          actor_id: 'user-manager',
          event_type: 'lead_edited',
          comment: null,
          old_value: null,
          new_value: null,
          created_at: '2026-07-10T01:00:00Z',
          profiles: { display_name: 'Kyiv Manager' },
        },
        {
          id: 'evt-blank-name',
          lead_id: 'lead-1',
          actor_id: 'user-x',
          event_type: 'comment',
          comment: 'hi',
          old_value: null,
          new_value: null,
          created_at: '2026-07-10T02:00:00Z',
          profiles: { display_name: '   ' },
        },
      ],
    });

    expect(lead.events[0]).toMatchObject({
      id: 'evt-created',
      type: 'created',
      rawType: 'created',
      actorId: 'user-super',
      actorName: 'Super Admin',
    });
    expect(lead.events[1]).toMatchObject({
      id: 'evt-edited',
      type: 'lead_updated',
      rawType: 'lead_edited',
      actorId: 'user-manager',
      actorName: 'Kyiv Manager',
    });
    expect(lead.events[2]).toMatchObject({
      id: 'evt-blank-name',
      type: 'comment',
      actorName: '',
    });
  });
});
