import { inject, Injectable } from '@angular/core';

import { KolssApiClient } from '../core/api/generated/kolss-api.client';
import type {
  Appointment,
  AppointmentListResponse,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from '../core/api/generated/kolss-api.types';

export interface AppointmentRange {
  readonly officeId: string;
  readonly from: string;
  readonly to: string;
  readonly managerId?: string;
  readonly status?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly api = inject(KolssApiClient);

  list(range: AppointmentRange): Promise<AppointmentListResponse> {
    return this.api.appointments(range);
  }

  async create(payload: CreateAppointmentRequest): Promise<Appointment> {
    return (await this.api.createAppointment(payload)).appointment;
  }

  async update(
    appointmentId: string,
    version: number,
    payload: UpdateAppointmentRequest,
  ): Promise<Appointment> {
    return (await this.api.updateAppointment(appointmentId, version, payload)).appointment;
  }
}

export function officeDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value['year']}-${value['month']}-${value['day']}`;
}

export interface CalendarAppointmentDeepLink {
  readonly leadId: string;
  readonly date: string;
  readonly officeId: string;
}

const OFFICE_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function calendarAppointmentDeepLink(input: {
  readonly leadId: string;
  readonly showroomDueAt: string;
  readonly officeId: string;
  readonly timeZone: string;
}): CalendarAppointmentDeepLink {
  return {
    leadId: input.leadId,
    date: officeDateKey(new Date(input.showroomDueAt), input.timeZone),
    officeId: input.officeId,
  };
}

export function parseCalendarAppointmentQuery(params: {
  get(name: string): string | null;
}): CalendarAppointmentDeepLink | null {
  const leadId = params.get('leadId');
  const date = params.get('date');
  const officeId = params.get('officeId');
  if (!leadId || !officeId || !date || !OFFICE_LOCAL_DATE.test(date)) return null;
  return { leadId, date, officeId };
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function officeDateTimeParts(
  instant: string,
  timeZone: string,
): { readonly date: string; readonly time: string; readonly weekday: number } {
  const date = new Date(instant);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date: `${value['year']}-${value['month']}-${value['day']}`,
    time: `${value['hour']}:${value['minute']}`,
    weekday: weekdays[value['weekday']] ?? 0,
  };
}
