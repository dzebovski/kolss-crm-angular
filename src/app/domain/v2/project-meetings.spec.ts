import type { Appointment } from '@core/api/generated/kolss-api.types';
import {
  toV2ProjectMeeting,
  v2CanChangeMeeting,
  v2MeetingDraftErrors,
  v2MeetingDuration,
  v2MeetingLocalParts,
  v2MeetingNeedsOutcome,
  v2NextProjectMeeting,
  type V2MeetingDraft,
  type V2ProjectMeeting,
} from './project-meetings';

const appointment = (patch: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  lead: { id: 'l1', referenceId: 'w0231', name: 'Marta', phone: '+48' },
  projectId: 'p1',
  office: { id: 'o1', code: 'WAW', name: 'Warszawa', timezoneName: 'Europe/Warsaw' },
  responsibleManager: { id: 'm1', displayName: ' Kasia ' },
  kind: 'measurement',
  startsAt: '2026-11-20T09:00:00Z',
  endsAt: '2026-11-20T10:30:00Z',
  status: 'scheduled',
  comment: '  ',
  purpose: null,
  version: 3,
  hasConflict: false,
  isOutsideWorkingHours: false,
  warnings: [],
  createdAt: '2026-11-15T09:00:00Z',
  updatedAt: '2026-11-15T09:00:00Z',
  ...patch,
});

const meeting = (patch: Partial<V2ProjectMeeting> = {}): V2ProjectMeeting => ({
  ...toV2ProjectMeeting(appointment()),
  ...patch,
});

describe('project meetings', () => {
  it('maps an appointment, trimming names and empty comments', () => {
    expect(toV2ProjectMeeting(appointment())).toMatchObject({
      kind: 'measurement',
      status: 'scheduled',
      manager: { id: 'm1', name: 'Kasia' },
      comment: null,
      timezone: 'Europe/Warsaw',
    });
    expect(toV2ProjectMeeting(appointment({ status: 'rescheduled' })).status).toBe('scheduled');
  });

  it('lets only a scheduled meeting of an open project change', () => {
    expect(v2CanChangeMeeting(meeting(), true)).toBe(true);
    expect(v2CanChangeMeeting(meeting(), false)).toBe(false);
    expect(v2CanChangeMeeting(meeting({ status: 'visited' }), true)).toBe(false);
  });

  it('asks for an outcome once a scheduled meeting has ended', () => {
    expect(v2MeetingNeedsOutcome(meeting(), new Date('2026-11-20T10:00:00Z'))).toBe(false);
    expect(v2MeetingNeedsOutcome(meeting(), new Date('2026-11-20T11:00:00Z'))).toBe(true);
  });

  it('finds the next scheduled meeting that has not ended', () => {
    const list = [
      meeting({ id: 'late', startsAt: '2026-11-25T09:00:00Z', endsAt: '2026-11-25T10:00:00Z' }),
      meeting({ id: 'past', startsAt: '2026-11-10T09:00:00Z', endsAt: '2026-11-10T10:00:00Z' }),
      meeting({ id: 'soon' }),
      meeting({ id: 'done', status: 'visited', startsAt: '2026-11-19T09:00:00Z' }),
    ];
    expect(v2NextProjectMeeting(list, new Date('2026-11-15T00:00:00Z'))?.id).toBe('soon');
    expect(v2NextProjectMeeting([], new Date())).toBeNull();
  });

  it('reads the duration and the office-local start', () => {
    expect(v2MeetingDuration(meeting())).toBe(90);
    expect(v2MeetingLocalParts('2026-11-20T09:00:00Z', 'Europe/Warsaw')).toEqual({
      date: '2026-11-20',
      time: '10:00',
    });
  });

  it('validates the popup', () => {
    const draft: V2MeetingDraft = {
      kind: 'showroom',
      date: '2026-11-20',
      time: '10:00',
      duration: 60,
      managerId: 'm1',
      comment: '',
    };
    expect(v2MeetingDraftErrors(draft, '2026-11-15')).toEqual({});
    expect(
      v2MeetingDraftErrors({ ...draft, date: '2026-11-10', time: '', managerId: '' }, '2026-11-15'),
    ).toEqual({ date: 'datePassed', time: 'time', manager: 'manager' });
  });
});
