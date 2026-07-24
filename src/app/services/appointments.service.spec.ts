import { TestBed } from '@angular/core/testing';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import type { Appointment } from '../core/api/generated/kolss-api.types';
import {
  addCalendarDays,
  AppointmentsService,
  calendarAppointmentDeepLink,
  officeDateKey,
  officeDateTimeParts,
  parseCalendarAppointmentQuery,
} from './appointments.service';

const appointment: Appointment = {
  id: 'appointment-1',
  lead: { id: 'lead-1', name: 'Анна', phone: '+380501112233' },
  office: {
    id: 'office-kyiv',
    code: 'kyiv',
    name: 'Київ',
    timezoneName: 'Europe/Kyiv',
  },
  responsibleManager: { id: 'manager-1', displayName: 'Олена' },
  startsAt: '2026-07-23T07:00:00.000Z',
  endsAt: '2026-07-23T08:00:00.000Z',
  status: 'scheduled',
  comment: null,
  version: 1,
  hasConflict: false,
  isOutsideWorkingHours: false,
  warnings: [],
  createdAt: '2026-07-20T12:00:00.000Z',
  updatedAt: '2026-07-20T12:00:00.000Z',
};

describe('AppointmentsService', () => {
  it('maps list, create and optimistic update through the generated client', async () => {
    const api = {
      appointments: vi.fn().mockResolvedValue({
        items: [appointment],
        timezone: 'Europe/Kyiv',
        from: '2026-07-23',
        to: '2026-07-24',
      }),
      createAppointment: vi.fn().mockResolvedValue({ appointment, warnings: [] }),
      updateAppointment: vi.fn().mockResolvedValue({
        appointment: { ...appointment, version: 2 },
        warnings: [],
      }),
    };
    await TestBed.configureTestingModule({
      providers: [AppointmentsService, { provide: KolssApiClient, useValue: api }],
    }).compileComponents();
    const service = TestBed.inject(AppointmentsService);

    await service.list({
      officeId: 'office-kyiv',
      from: '2026-07-23',
      to: '2026-07-24',
    });
    await service.create({
      leadId: 'lead-1',
      startsAtLocal: '2026-07-23T10:00',
      durationMinutes: 60,
      responsibleManagerId: 'manager-1',
    });
    const updated = await service.update('appointment-1', 1, { status: 'visited' });

    expect(api.appointments).toHaveBeenCalledWith({
      officeId: 'office-kyiv',
      from: '2026-07-23',
      to: '2026-07-24',
    });
    expect(api.updateAppointment).toHaveBeenCalledWith('appointment-1', 1, {
      status: 'visited',
    });
    expect(updated.version).toBe(2);
  });
});

describe('appointment office-time helpers', () => {
  it('uses the office day instead of the browser day', () => {
    const instant = new Date('2026-07-22T22:30:00.000Z');
    expect(officeDateKey(instant, 'Europe/Kyiv')).toBe('2026-07-23');
    expect(officeDateKey(instant, 'Europe/Warsaw')).toBe('2026-07-23');
  });

  it('formats an instant in the selected office timezone', () => {
    expect(officeDateTimeParts('2026-12-01T08:30:00.000Z', 'Europe/Warsaw')).toEqual({
      date: '2026-12-01',
      time: '09:30',
      weekday: 2,
    });
    expect(officeDateTimeParts('2026-12-01T08:30:00.000Z', 'Europe/Kyiv')).toEqual({
      date: '2026-12-01',
      time: '10:30',
      weekday: 2,
    });
  });

  it('adds date-only days without browser timezone drift', () => {
    expect(addCalendarDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('builds and parses calendar appointment deep-link query params', () => {
    expect(
      calendarAppointmentDeepLink({
        leadId: 'lead-1',
        showroomDueAt: '2026-07-22T22:30:00.000Z',
        officeId: 'office-kyiv',
        timeZone: 'Europe/Kyiv',
      }),
    ).toEqual({
      leadId: 'lead-1',
      date: '2026-07-23',
      officeId: 'office-kyiv',
    });
    expect(
      parseCalendarAppointmentQuery({
        get: (name) =>
          ({ leadId: 'lead-1', date: '2026-07-23', officeId: 'office-kyiv' })[name] ?? null,
      }),
    ).toEqual({
      leadId: 'lead-1',
      date: '2026-07-23',
      officeId: 'office-kyiv',
    });
    expect(
      parseCalendarAppointmentQuery({
        get: (name) => (name === 'leadId' ? 'lead-1' : null),
      }),
    ).toBeNull();
  });
});
