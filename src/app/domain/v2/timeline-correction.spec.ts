import type { LeadEvent } from '@domain/lead.types';
import { v2EventCorrectionType, v2TimelineCorrectionRequest } from './timeline-correction';

function event(category: LeadEvent['category'], statusCode: string | null): LeadEvent {
  return {
    id: 'event-1',
    type: 'call_status_changed',
    rawType: 'call_status_changed',
    comment: 'Original',
    newValue: {},
    actorId: 'user-1',
    occurredAt: '2026-09-25T10:00:00Z',
    category,
    statusCode,
  };
}

describe('v2 timeline correction rules', () => {
  it('maps only the five W12 correctable event kinds', () => {
    expect(v2EventCorrectionType(event('call_status', 'reached'))).toBe('success');
    expect(v2EventCorrectionType(event('call_status', 'callback_requested'))).toBe('later');
    expect(v2EventCorrectionType(event('call_status', 'no_answer'))).toBe('noanswer');
    expect(v2EventCorrectionType(event('client_status', 'thinking'))).toBe('thinking');
    expect(v2EventCorrectionType(event('client_status', 'showroom_invited'))).toBeNull();
  });

  it('builds a minimal correction and includes the required due date for reminder types', () => {
    expect(
      v2TimelineCorrectionRequest(
        { type: 'noanswer', comment: 'Original' },
        {
          type: 'later',
          comment: 'Corrected',
          dueAt: '2026-09-29T10:00:00.000Z',
          reason: 'Wrong result',
        },
      ),
    ).toEqual({
      type: 'later',
      dueAt: '2026-09-29T10:00:00.000Z',
      comment: 'Corrected',
      reason: 'Wrong result',
    });
  });

  it('returns null when nothing changed', () => {
    expect(
      v2TimelineCorrectionRequest(
        { type: 'comment', comment: 'Same' },
        { type: 'comment', comment: ' Same ', dueAt: '', reason: '' },
      ),
    ).toBeNull();
  });
});
