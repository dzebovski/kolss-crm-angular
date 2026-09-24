import type { Lead, LeadEvent } from '@domain/lead.types';
import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import { v2CurrentStatus, v2LeadTasks } from './lead-card-status';

const base: Lead = { ...FIXTURE_LEADS[0], assignedToId: 'manager-1', callbackDueAt: null };

function event(partial: Partial<LeadEvent>): LeadEvent {
  return {
    id: 'evt',
    type: 'call_status_changed',
    rawType: 'call_status_changed',
    comment: null,
    newValue: null,
    actorId: 'manager-1',
    occurredAt: '2026-09-20T10:00:00.000Z',
    ...partial,
  };
}

describe('v2 lead card status', () => {
  it('shows no current status for a new lead', () => {
    expect(v2CurrentStatus(base, 'new', 0)).toBeNull();
  });

  it('takes the latest No answer event: attempt, next attempt and comment', () => {
    const lead: Lead = {
      ...base,
      events: [
        event({
          id: 'a',
          category: 'call_status',
          statusCode: 'no_answer',
          newValue: { attempt: 1 },
        }),
        event({
          id: 'b',
          category: 'call_status',
          statusCode: 'no_answer',
          occurredAt: '2026-09-22T11:40:00.000Z',
          comment: ' Voicemail ',
          newValue: { attempt: 2, callback_due_at: '2026-09-23T14:00:00.000Z' },
        }),
      ],
    };
    expect(v2CurrentStatus(lead, 'noanswer', 2)).toEqual({
      rows: [
        { label: 'attempt', value: { kind: 'text', text: '2' } },
        { label: 'nextAttempt', value: { kind: 'dateTime', at: '2026-09-23T14:00:00.000Z' } },
      ],
      comment: 'Voicemail',
    });
  });

  it('reads the showroom visit and the v2 loss reason', () => {
    const invited: Lead = {
      ...base,
      events: [
        event({
          category: 'client_status',
          statusCode: 'showroom_invited',
          newValue: {
            starts_at: '2026-09-26T10:00:00Z',
            ends_at: '2026-09-26T11:00:00Z',
            designer_id: 'designer-1',
          },
        }),
      ],
    };
    expect(v2CurrentStatus(invited, 'invited', 0)?.rows).toEqual([
      {
        label: 'when',
        value: { kind: 'range', start: '2026-09-26T10:00:00Z', end: '2026-09-26T11:00:00Z' },
      },
      { label: 'designer', value: { kind: 'person', id: 'designer-1' } },
      { label: 'where', value: { kind: 'office' } },
    ]);

    const lost: Lead = {
      ...base,
      events: [
        event({
          category: 'client_status',
          statusCode: 'closed_lost',
          newValue: { reason: 'other', loss_reason: 'bought_elsewhere' },
        }),
      ],
    };
    expect(v2CurrentStatus(lost, 'lost', 0)?.rows).toEqual([
      { label: 'reason', value: { kind: 'lossReason', code: 'bought_elsewhere' } },
    ]);
  });

  it('lists reminders earliest first and marks overdue ones', () => {
    const lead: Lead = {
      ...base,
      callStatus: 'no_answer',
      callbackDueAt: '2026-09-25T10:00:00.000Z',
      callbackDueContext: { category: 'call_status', statusCode: 'no_answer' },
      commentReminderDueAt: '2026-09-22T09:00:00.000Z',
      commentReminderAssignedTo: 'colleague-1',
      events: [
        event({
          category: 'comment',
          comment: 'Send the kitchen visualisations and the price list for the island',
          newValue: { callback_due_at: '2026-09-22T09:00:00.000Z' },
        }),
      ],
    };
    const tasks = v2LeadTasks(lead, new Date('2026-09-24T12:00:00.000Z'));
    expect(tasks.map((task) => [task.kind, task.title, task.overdue, task.assigneeId])).toEqual([
      ['comment', 'comment', true, 'colleague-1'],
      ['callback', 'callAgain', false, 'manager-1'],
    ]);
    expect(tasks[0].text).toBe('Send the kitchen visualisations and the pr…');
  });
});
