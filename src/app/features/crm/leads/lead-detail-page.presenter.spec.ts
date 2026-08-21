import { FIXTURE_EMPLOYEES, FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import type { LeadEvent } from '@domain/lead.types';
import {
  activeOfficeStaffOptions,
  clientStatusLabelForLead,
  closeReasonLabelForLead,
  closeSummaryLine,
  eventBody,
  eventDueDate,
  eventStatusLabel,
  eventStatusTone,
  eventTitle,
  isCallStatus,
  isClientStatus,
} from './lead-detail-page.presenter';

describe('lead-detail-page.presenter', () => {
  describe('isCallStatus / isClientStatus', () => {
    it('recognizes only known call statuses', () => {
      expect(isCallStatus('reached')).toBe(true);
      expect(isCallStatus('no_answer')).toBe(true);
      expect(isCallStatus('callback_requested')).toBe(true);
      expect(isCallStatus('thinking')).toBe(false);
      expect(isCallStatus(null)).toBe(false);
      expect(isCallStatus(undefined)).toBe(false);
    });

    it('recognizes only known client statuses', () => {
      expect(isClientStatus('new_lead')).toBe(true);
      expect(isClientStatus('contract_signed')).toBe(true);
      expect(isClientStatus('postponed')).toBe(true);
      expect(isClientStatus('reached')).toBe(false);
      expect(isClientStatus(null)).toBe(false);
    });
  });

  describe('eventStatusLabel / eventStatusTone', () => {
    const labels = {
      callStatusLabel: (status: string) => `call:${status}`,
      clientStatusLabel: (status: string) => `client:${status}`,
    };
    const tones = {
      callStatusTone: () => 'success' as const,
      clientStatusTone: () => 'warning' as const,
    };

    function event(overrides: Partial<LeadEvent>): LeadEvent {
      return {
        id: 'e1',
        type: 'client_status_changed',
        rawType: 'client_status_changed',
        comment: null,
        newValue: null,
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: null,
        statusCode: null,
        ...overrides,
      };
    }

    it('labels a call-status event via callStatusLabel', () => {
      const e = event({ category: 'call_status', statusCode: 'reached' });
      expect(eventStatusLabel(e, labels)).toBe('call:reached');
      expect(eventStatusTone(e, tones)).toBe('success');
    });

    it('labels a client-status or system event via clientStatusLabel', () => {
      const e = event({ category: 'client_status', statusCode: 'thinking' });
      expect(eventStatusLabel(e, labels)).toBe('client:thinking');
      expect(eventStatusTone(e, tones)).toBe('warning');

      const system = event({ category: 'system', statusCode: 'new_lead' });
      expect(eventStatusLabel(system, labels)).toBe('client:new_lead');
    });

    it('falls back to the raw status code for an unrecognized value', () => {
      const e = event({ category: 'call_status', statusCode: 'unknown_status' });
      expect(eventStatusLabel(e, labels)).toBe('unknown_status');
      expect(eventStatusTone(e, tones)).toBe('neutral');
    });

    it('returns an empty label/neutral tone when there is no status code', () => {
      const e = event({ category: 'comment', statusCode: null });
      expect(eventStatusLabel(e, labels)).toBe('');
      expect(eventStatusTone(e, tones)).toBe('neutral');
    });
  });

  describe('eventTitle / eventBody', () => {
    it('renders the raw event type key when the bundle has no translation loaded', () => {
      const e: LeadEvent = {
        id: 'e1',
        type: 'comment_added',
        rawType: 'comment_added',
        comment: 'Hello',
        newValue: null,
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: 'comment',
        statusCode: null,
      };
      expect(eventTitle(e, null)).toBe('comment_added');
    });

    it('returns the trimmed comment when a status badge already carries the label', () => {
      const e: LeadEvent = {
        id: 'e1',
        type: 'client_status_changed',
        rawType: 'client_status_changed',
        comment: '  Клієнт очікує кошторис.  ',
        newValue: null,
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: 'client_status',
        statusCode: 'calculation_in_progress',
      };
      expect(eventBody(e, null, 'Прорахунок')).toBe('Клієнт очікує кошторис.');
    });
  });

  describe('eventDueDate', () => {
    const dueAt = '2026-08-03T12:00:00.000Z';

    it('returns null when there is no callback_due_at on the event', () => {
      const e: LeadEvent = {
        id: 'e1',
        type: 'comment_added',
        rawType: 'comment_added',
        comment: null,
        newValue: null,
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: 'comment',
        statusCode: null,
      };
      expect(eventDueDate(e)).toBeNull();
    });

    it('tags a comment event as kind "comment"', () => {
      const e: LeadEvent = {
        id: 'e1',
        type: 'comment_added',
        rawType: 'comment_added',
        comment: null,
        newValue: { callback_due_at: dueAt },
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: 'comment',
        statusCode: null,
      };
      expect(eventDueDate(e)).toEqual({ date: dueAt, kind: 'comment' });
    });

    it('tags a callback_requested call-status event as kind "status"', () => {
      const e: LeadEvent = {
        id: 'e1',
        type: 'call_status_changed',
        rawType: 'call_status_changed',
        comment: null,
        newValue: { callback_due_at: dueAt },
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: 'call_status',
        statusCode: 'callback_requested',
      };
      expect(eventDueDate(e)).toEqual({ date: dueAt, kind: 'status' });
    });

    it('tags a postponed client-status event as kind "status"', () => {
      const e: LeadEvent = {
        id: 'e1',
        type: 'client_status_changed',
        rawType: 'client_status_changed',
        comment: null,
        newValue: { callback_due_at: dueAt },
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: 'client_status',
        statusCode: 'postponed',
      };
      expect(eventDueDate(e)).toEqual({ date: dueAt, kind: 'status' });
    });

    it('ignores an unrelated event even when it carries a callback_due_at', () => {
      const e: LeadEvent = {
        id: 'e1',
        type: 'lead_updated',
        rawType: 'lead_updated',
        comment: null,
        newValue: { callback_due_at: dueAt },
        actorId: '',
        actorName: '',
        occurredAt: '2026-07-16T09:15:00.000Z',
        category: null,
        statusCode: null,
      };
      expect(eventDueDate(e)).toBeNull();
    });
  });

  describe('clientStatusLabelForLead', () => {
    it('shows the "taken" workflow label for a new lead that already has a call recorded', () => {
      const lead = {
        ...FIXTURE_LEADS[0]!,
        clientStatus: 'new_lead' as const,
        callStatus: 'reached' as const,
      };
      expect(clientStatusLabelForLead(lead, (s) => `client:${s}`, 'В роботі')).toBe('В роботі');
    });

    it('falls back to the plain client-status label otherwise', () => {
      const lead = { ...FIXTURE_LEADS[0]!, clientStatus: 'thinking' as const, callStatus: null };
      expect(clientStatusLabelForLead(lead, (s) => `client:${s}`, 'В роботі')).toBe(
        'client:thinking',
      );
    });
  });

  describe('closeSummaryLine', () => {
    it('returns an empty string when the lead has no close payload', () => {
      expect(closeSummaryLine({ close: null }, 'Закрито', (code) => code)).toBe('');
    });

    it('joins the closed label, reason label and trimmed comment', () => {
      const lead = {
        close: {
          reason: 'expensive' as const,
          comment: '  Клієнт відмовився.  ',
          closedAt: '2026-07-16T09:15:00.000Z',
          actorId: 'emp-kyiv-1',
        },
      };
      expect(closeSummaryLine(lead, 'Закрито', () => 'Дорого')).toBe(
        'Закрито - Дорого - Клієнт відмовився.',
      );
    });

    it('omits an empty comment instead of leaving a trailing separator', () => {
      const lead = {
        close: {
          reason: 'expensive' as const,
          comment: '   ',
          closedAt: '2026-07-16T09:15:00.000Z',
          actorId: 'emp-kyiv-1',
        },
      };
      expect(closeSummaryLine(lead, 'Закрито', () => 'Дорого')).toBe('Закрито - Дорого');
    });
  });

  describe('closeReasonLabelForLead', () => {
    it('returns an empty string when the lead has no close payload', () => {
      expect(closeReasonLabelForLead({ close: null }, (code) => code)).toBe('');
    });

    it('returns the reason label when the lead is closed', () => {
      const lead = {
        close: {
          reason: 'expensive' as const,
          comment: '',
          closedAt: '2026-07-16T09:15:00.000Z',
          actorId: 'emp-kyiv-1',
        },
      };
      expect(closeReasonLabelForLead(lead, () => 'Дорого')).toBe('Дорого');
    });
  });

  describe('activeOfficeStaffOptions', () => {
    const isSuperAdmin = (role: string) => role === 'super_admin';

    it('puts the placeholder first, followed by active non-super-admin office staff', () => {
      const options = activeOfficeStaffOptions(FIXTURE_EMPLOYEES, 'kyiv', isSuperAdmin, {
        value: '',
        label: 'Не призначено',
      });
      expect(options[0]).toEqual({ value: '', label: 'Не призначено' });
      expect(options.slice(1).every((option) => option.value !== 'emp-super-admin')).toBe(true);
      expect(options.slice(1).every((option) => option.value !== 'emp-warsaw-1')).toBe(true);
      expect(options.some((option) => option.value === 'emp-kyiv-1')).toBe(true);
    });
  });
});
