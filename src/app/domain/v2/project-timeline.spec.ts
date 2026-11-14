import { v2ProjectTimeline } from './project-timeline';
import type { V2ProjectTimelineEntry } from './project.types';

const entry = (patch: Partial<V2ProjectTimelineEntry>): V2ProjectTimelineEntry => ({
  id: 'e1',
  type: 'created',
  actor: { id: 'u1', name: 'Kasia Nowak' },
  oldValue: null,
  newValue: null,
  comment: null,
  createdAt: '2026-09-18T12:40:00Z',
  ...patch,
});

describe('v2ProjectTimeline', () => {
  it('maps a created event with its type, first status and lead code', () => {
    const [item] = v2ProjectTimeline(
      [
        entry({
          newValue: { status: 'preliminary_estimate', projectType: 'measure', managerId: 'm1' },
        }),
      ],
      'W0218',
    );
    expect(item.titleKey).toBe('v2.projectCard.event.created');
    expect(item.leadCode).toBe('W0218');
    expect(item.actorName).toBe('Kasia Nowak');
    expect(item.rows.map((row) => row.value.kind)).toEqual(['projectType', 'status']);
  });

  it('shows a status move with the next event and the comment', () => {
    const [item] = v2ProjectTimeline(
      [
        entry({
          type: 'status_changed',
          oldValue: { status: 'contract_signing', eventDate: null, eventTime: null },
          newValue: { status: 'production_delivery', eventDate: '2026-11-29', eventTime: '10:00' },
          comment: ' Client pays the rest on Monday ',
        }),
      ],
      'W0218',
    );
    expect(item.change).toEqual({ from: 'contract_signing', to: 'production_delivery' });
    expect(item.tone).toBe('production_delivery');
    expect(item.text).toBe('Client pays the rest on Monday');
    expect(item.rows).toEqual([
      {
        labelKey: 'v2.project.nextEvent.production_delivery',
        value: { kind: 'day', day: '2026-11-29', time: '10:00' },
      },
    ]);
  });

  it('drops pipeline 3 statuses from old history instead of showing them', () => {
    const [item] = v2ProjectTimeline(
      [
        entry({
          type: 'status_changed',
          oldValue: { status: 'design' },
          newValue: { status: 'factory_review' },
        }),
      ],
      'W0218',
    );
    expect(item.change).toBeNull();
    expect(item.tone).toBe('faint');
  });

  it('maps payment, document, estimate, finish, close and restore payloads', () => {
    const items = v2ProjectTimeline(
      [
        entry({
          id: 'a',
          type: 'payment_added',
          newValue: { amount: 500, currency: 'PLN', paidOn: '2026-09-25', basis: 'receipt' },
        }),
        entry({ id: 'b', type: 'file_deleted', oldValue: { fileId: 'f', fileName: 'umowa.pdf' } }),
        entry({ id: 'c', type: 'estimate_updated', newValue: null }),
        entry({ id: 'd', type: 'finished', newValue: { status: 'completed' } }),
        entry({
          id: 'e',
          type: 'cancelled',
          oldValue: { status: 'factory_approval' },
          newValue: {
            status: 'cancelled',
            reasons: ['price_too_high', 'unknown'],
            futureEventsCancelled: true,
          },
        }),
        entry({
          id: 'f',
          type: 'restored',
          oldValue: { status: 'cancelled' },
          newValue: { status: 'factory_approval' },
        }),
      ],
      'W0218',
    );
    expect(items[0].rows.map((row) => row.value)).toEqual([
      { kind: 'money', money: { amount: 500, currency: 'PLN' } },
      { kind: 'basis', basis: 'receipt' },
      { kind: 'day', day: '2026-09-25', time: null },
    ]);
    expect(items[1].rows).toEqual([
      { labelKey: 'v2.projectCard.row.file', value: { kind: 'text', text: 'umowa.pdf' } },
    ]);
    expect(items[2].rows[0].value).toEqual({ kind: 'removed' });
    expect(items[3]).toMatchObject({
      titleKey: 'v2.projectCard.event.finished',
      tone: 'completed',
    });
    expect(items[4].rows[0].value).toEqual({ kind: 'reasons', reasons: ['price_too_high'] });
    expect(items[4].rows[1].value.kind).toBe('futureEventsRemoved');
    expect(items[5].change).toEqual({ from: 'cancelled', to: 'factory_approval' });
  });

  it('keeps old contract events as a bare line and comments as text', () => {
    const items = v2ProjectTimeline(
      [
        entry({ id: 'a', type: 'contract_deleted', oldValue: { kind: 'intro' } }),
        entry({ id: 'b', type: 'comment', comment: 'Called the client' }),
      ],
      'W0218',
    );
    expect(items[0]).toMatchObject({ titleKey: 'v2.projectCard.event.contractDeleted', rows: [] });
    expect(items[1]).toMatchObject({ tone: 'ink', text: 'Called the client', rows: [] });
  });

  it('survives payloads without values', () => {
    const [item] = v2ProjectTimeline([entry({ type: 'payment_added', actor: null })], 'W0218');
    expect(item.actorName).toBeNull();
    expect(item.rows).toEqual([]);
  });
});
