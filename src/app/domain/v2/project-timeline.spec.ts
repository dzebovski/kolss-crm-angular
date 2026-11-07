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
      [entry({ newValue: { status: 'estimate', projectType: 'measure', managerId: 'm1' } })],
      'W0218',
    );
    expect(item.titleKey).toBe('v2.projectCard.event.created');
    expect(item.leadCode).toBe('W0218');
    expect(item.actorName).toBe('Kasia Nowak');
    expect(item.rows.map((row) => row.value.kind)).toEqual(['projectType', 'status']);
  });

  it('shows a status move with the next event and the 50% override', () => {
    const [item] = v2ProjectTimeline(
      [
        entry({
          type: 'status_changed',
          oldValue: { status: 'main_contract', eventDate: null, eventTime: null },
          newValue: {
            status: 'production',
            eventDate: '2026-11-29',
            eventTime: '10:00',
            prepaymentOverride: true,
          },
          comment: ' Client pays the rest on Monday ',
        }),
      ],
      'W0218',
    );
    expect(item.change).toEqual({ from: 'main_contract', to: 'production' });
    expect(item.tone).toBe('production');
    expect(item.text).toBe('Client pays the rest on Monday');
    expect(item.rows).toEqual([
      {
        labelKey: 'v2.project.nextEvent.production',
        value: { kind: 'day', day: '2026-11-29', time: '10:00' },
      },
      { labelKey: 'v2.projectCard.row.prepayment', value: { kind: 'prepaymentOverride' } },
    ]);
  });

  it('keeps a details-only update without status pills', () => {
    const [item] = v2ProjectTimeline(
      [entry({ type: 'status_updated', newValue: { status: 'design', eventDate: null } })],
      'W0218',
    );
    expect(item.change).toBeNull();
    expect(item.rows).toEqual([]);
  });

  it('maps contract, payment, cancel and restore payloads', () => {
    const items = v2ProjectTimeline(
      [
        entry({
          id: 'a',
          type: 'contract_added',
          oldValue: { status: 'design' },
          newValue: {
            status: 'design',
            kind: 'main',
            number: 'KW/1',
            signedOn: '2026-09-25',
            totalAmount: 80000,
            currency: 'PLN',
          },
        }),
        entry({
          id: 'b',
          type: 'payment_added',
          newValue: {
            contractKind: 'intro',
            amount: 40000,
            currency: 'PLN',
            paidOn: '2026-09-25',
            paidAfter: 40000,
            total: 80000,
            note: 'Prepayment',
          },
        }),
        entry({
          id: 'c',
          type: 'cancelled',
          oldValue: { status: 'design' },
          newValue: {
            status: 'cancelled',
            reasons: ['price_too_high', 'unknown'],
            futureEventsCancelled: true,
          },
        }),
        entry({
          id: 'd',
          type: 'restored',
          oldValue: { status: 'cancelled' },
          newValue: { status: 'design' },
        }),
      ],
      'W0218',
    );
    // A main contract signed after design does not move the stage backwards: no pills.
    expect(items[0].change).toBeNull();
    expect(items[0].titleKey).toBe('v2.projectCard.event.mainAdded');
    expect(items[0].tone).toBe('main_contract');
    expect(items[0].rows.map((row) => row.value.kind)).toEqual(['text', 'money', 'day']);
    expect(items[1].tone).toBe('intro_contract');
    expect(items[1].rows.map((row) => row.value.kind)).toEqual([
      'contractKind',
      'money',
      'moneyOf',
      'day',
      'text',
    ]);
    expect(items[2].rows[0].value).toEqual({ kind: 'reasons', reasons: ['price_too_high'] });
    expect(items[2].rows[1].value.kind).toBe('futureEventsRemoved');
    expect(items[3].change).toEqual({ from: 'cancelled', to: 'design' });
  });

  it('reads a deleted contract from the old value and lists changed estimate lines', () => {
    const items = v2ProjectTimeline(
      [
        entry({
          id: 'a',
          type: 'contract_deleted',
          oldValue: { kind: 'intro', number: 'W/1', totalAmount: 1000, currency: 'PLN' },
        }),
        entry({
          id: 'b',
          type: 'estimate_updated',
          oldValue: { kitchen: null, countertop: { amount: 5000, currency: 'PLN' } },
          newValue: { kitchen: { amount: 42000, currency: 'PLN' }, countertop: null },
        }),
        entry({ id: 'c', type: 'comment', comment: 'Called the client' }),
      ],
      'W0218',
    );
    expect(items[0].titleKey).toBe('v2.projectCard.event.introDeleted');
    expect(items[0].rows.map((row) => row.value.kind)).toEqual(['text', 'money']);
    expect(items[1].rows).toEqual([
      {
        labelKey: 'v2.project.estimate.kitchen',
        value: { kind: 'estimateLine', money: { amount: 42000, currency: 'PLN' } },
      },
      { labelKey: 'v2.project.estimate.countertop', value: { kind: 'estimateLine', money: null } },
    ]);
    expect(items[2]).toMatchObject({ tone: 'ink', text: 'Called the client', rows: [] });
  });

  it('survives payloads without values', () => {
    const [item] = v2ProjectTimeline([entry({ type: 'payment_added', actor: null })], 'W0218');
    expect(item.actorName).toBeNull();
    expect(item.rows).toEqual([]);
  });
});
