import type { Lead } from '@domain/lead.types';
import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import {
  isV2BudgetText,
  v2ActionSuggestion,
  v2IsoToLocalDateTime,
  v2LocalDateTimeToIso,
} from './lead-action';
import type { V2LeadTask } from './lead-card-status';

const now = new Date('2026-09-23T12:00:00');
const lead: Lead = { ...FIXTURE_LEADS[0], events: [] };
const task = (kind: V2LeadTask['kind'], dueAt: string): V2LeadTask => ({
  kind,
  dueAt,
  title: 'callBack',
  text: null,
  assigneeId: null,
  overdue: new Date(dueAt) < now,
});

describe('v2 lead action panel rules', () => {
  it('suggests the first call for a new lead', () => {
    expect(v2ActionSuggestion(lead, 'new', [], now)).toMatchObject({
      title: 'makeCall',
      on: null,
      caption: { kind: 'created', at: lead.sourceCreatedAt },
    });
  });

  it('uses the nearest status reminder, not a comment reminder, and flags it overdue', () => {
    const called: Lead = {
      ...lead,
      events: [
        {
          id: 'c',
          type: 'call_status_changed',
          rawType: 'call_status_changed',
          comment: null,
          newValue: null,
          actorId: 'm',
          occurredAt: '2026-09-22T10:00:00.000Z',
          category: 'call_status',
          statusCode: 'no_answer',
        },
      ],
    };
    const tasks = [task('comment', '2026-09-20T09:00:00'), task('callback', '2026-09-23T10:00:00')];
    expect(v2ActionSuggestion(called, 'noanswer', tasks, now)).toMatchObject({
      title: 'callAgain',
      on: '2026-09-23T10:00:00',
      overdue: true,
      caption: { kind: 'lastCall', at: '2026-09-22T10:00:00.000Z' },
    });
    expect(v2ActionSuggestion(called, 'success', [], now).title).toBe('planNextStep');
    expect(v2ActionSuggestion(called, 'lost', tasks, now)).toMatchObject({
      title: 'noAction',
      quiet: true,
    });
  });

  it('accepts a budget as one number or a range', () => {
    expect(isV2BudgetText('')).toBe(true);
    expect(isV2BudgetText('20000')).toBe(true);
    expect(isV2BudgetText('20 000 – 25 000')).toBe(true);
    expect(isV2BudgetText('20 000-25 000,50')).toBe(true);
    expect(isV2BudgetText('25 000 – 20 000')).toBe(false);
    expect(isV2BudgetText('20 000 zł')).toBe(false);
  });

  it('round-trips datetime-local values in the viewer time', () => {
    const iso = v2LocalDateTimeToIso('2026-09-26T12:00');
    expect(iso).toBe(new Date(2026, 8, 26, 12, 0).toISOString());
    expect(v2IsoToLocalDateTime(iso)).toBe('2026-09-26T12:00');
    expect(v2LocalDateTimeToIso('')).toBeNull();
    expect(v2IsoToLocalDateTime(null)).toBe('');
  });
});
