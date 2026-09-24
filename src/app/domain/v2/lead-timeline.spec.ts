import type { Lead, LeadEvent } from '@domain/lead.types';
import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import { matchesV2TimelineFilter, v2LeadTimeline } from './lead-timeline';

function event(partial: Partial<LeadEvent>): LeadEvent {
  return {
    id: 'evt',
    type: 'comment',
    rawType: 'comment',
    comment: null,
    newValue: null,
    actorId: 'manager-1',
    actorName: 'Danuta',
    occurredAt: '2026-09-20T10:00:00.000Z',
    ...partial,
  };
}

const lead: Lead = {
  ...FIXTURE_LEADS[0],
  initialMessage: 'Kitchen with an island, please.',
  events: [
    event({
      id: 'status',
      rawType: 'client_status_changed',
      category: 'client_status',
      statusCode: 'showroom_invited',
      occurredAt: '2026-09-21T10:24:00.000Z',
      newValue: { appointment_id: 'a1', starts_at: '2026-09-26T10:00:00Z' },
    }),
    event({
      id: 'call',
      rawType: 'call_status_changed',
      category: 'call_status',
      statusCode: 'reached',
      occurredAt: '2026-09-21T10:20:00.000Z',
      newValue: { budget: { text: '22 000 – 25 000', currency: 'PLN' }, products: ['kitchen'] },
    }),
    event({
      id: 'rating',
      rawType: 'rating_changed',
      category: 'system',
      occurredAt: '2026-09-21T10:21:00.000Z',
      newValue: { from: null, to: 'hot' },
    }),
  ],
};

describe('v2 lead timeline', () => {
  const items = v2LeadTimeline(lead, 'meta_ads');

  it('orders entries newest first and adds the first message from the lead', () => {
    expect(items.map((item) => item.id)).toEqual(['status', 'rating', 'call', 'first-message']);
    expect(items[3]).toMatchObject({
      category: 'message',
      form: 'meta',
      quote: 'Kitchen with an island, please.',
      at: lead.sourceCreatedAt,
    });
  });

  it('replays statuses for the from → to change', () => {
    expect(items[0].change).toEqual({
      from: { kind: 'status', status: 'success' },
      to: { kind: 'status', status: 'invited' },
    });
    expect(items[0].rows.map((row) => row.label)).toEqual(['when', 'calendar']);
    expect(items[1].change).toEqual({
      from: { kind: 'rating', rating: null },
      to: { kind: 'rating', rating: 'hot' },
    });
    expect(items[2].rows).toEqual([
      { label: 'budget', value: { kind: 'budget', amount: '22 000 – 25 000', currency: 'PLN' } },
      { label: 'product', value: { kind: 'products', products: ['kitchen'] } },
    ]);
  });

  it('filters as the design: first message everywhere, system entries under Status', () => {
    const shown = (filter: 'call' | 'status' | 'comment') =>
      items.filter((item) => matchesV2TimelineFilter(item, filter)).map((item) => item.id);
    expect(shown('call')).toEqual(['call', 'first-message']);
    expect(shown('status')).toEqual(['status', 'rating', 'first-message']);
    expect(shown('comment')).toEqual(['first-message']);
    expect(matchesV2TimelineFilter({ category: 'system' }, 'status')).toBe(true);
  });

  it('shows a reopen as Lost → New and replays from New afterwards', () => {
    const reopened: Lead = {
      ...lead,
      events: [
        event({
          id: 'lost',
          rawType: 'client_status_changed',
          category: 'client_status',
          statusCode: 'closed_lost',
          occurredAt: '2026-09-22T09:00:00.000Z',
        }),
        event({
          id: 'reopen',
          rawType: 'lead_reopened',
          category: 'system',
          statusCode: 'new_lead',
          occurredAt: '2026-09-23T09:00:00.000Z',
        }),
        event({
          id: 'thinking',
          rawType: 'client_status_changed',
          category: 'client_status',
          statusCode: 'thinking',
          occurredAt: '2026-09-24T09:00:00.000Z',
        }),
      ],
    };
    const [thinking, reopen] = v2LeadTimeline(reopened, 'office');
    expect(reopen).toMatchObject({
      title: { kind: 'key', key: 'reopened' },
      change: { from: { kind: 'status', status: 'lost' }, to: { kind: 'status', status: 'new' } },
    });
    expect(thinking.change?.from).toEqual({ kind: 'status', status: 'new' });
  });
});
