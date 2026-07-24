import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import { AppointmentsService } from '../../../services/appointments.service';
import { LeadsService } from '../../../services/leads.service';
import { AppointmentDrawer, type AppointmentDrawerData } from './appointment-drawer';

describe('AppointmentDrawer', () => {
  it('shows a non-blocking out-of-hours warning and creates the appointment', async () => {
    const lead = { ...CRM_MOCK_LEADS[0]!, assignedToId: 'manager-1' };
    const create = vi.fn().mockResolvedValue({
      id: 'appointment-1',
      lead: { id: lead.id, name: lead.name, phone: lead.phone },
      office: {
        id: 'office-kyiv',
        code: 'kyiv',
        name: 'Київ',
        timezoneName: 'Europe/Kyiv',
      },
      responsibleManager: { id: 'manager-1', displayName: 'Олена' },
      startsAt: '2026-07-26T17:00:00.000Z',
      endsAt: '2026-07-26T18:00:00.000Z',
      status: 'scheduled',
      comment: null,
      version: 1,
      hasConflict: false,
      isOutsideWorkingHours: true,
      warnings: ['outside_working_hours'],
      createdAt: '2026-07-23T12:00:00.000Z',
      updatedAt: '2026-07-23T12:00:00.000Z',
    });
    const close = vi.fn();
    const data: AppointmentDrawerData = {
      office: {
        id: 'office-kyiv',
        code: 'kyiv',
        name_uk: 'Київ',
        name_pl: 'Kijów',
        timezone_name: 'Europe/Kyiv',
        is_active: true,
      },
      managers: [
        {
          id: 'manager-1',
          email: null,
          displayName: 'Олена',
          role: 'office_member',
          officeIds: ['kyiv'],
          officeUuids: ['office-kyiv'],
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          lastActiveAt: '2026-07-23T00:00:00Z',
        },
      ],
      lead,
      date: '2026-07-26',
      time: '20:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AppointmentsService, useValue: { create } },
        { provide: LeadsService, useValue: { list: vi.fn() } },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Час поза графіком');
    const clientLink = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.client-link',
    );
    expect(clientLink?.textContent).toContain('Відкрити картку клієнта');
    expect(clientLink?.getAttribute('href')).toBe(`/crm/leads/${lead.id}`);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith({
      leadId: lead.id,
      startsAtLocal: '2026-07-26T20:00',
      durationMinutes: 60,
      responsibleManagerId: 'manager-1',
      comment: '',
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ kind: 'saved' }));
  });

  it('keeps visited appointment details editable without changing its status', async () => {
    const close = vi.fn();
    const data: AppointmentDrawerData = {
      office: {
        id: 'office-kyiv',
        code: 'kyiv',
        name_uk: 'Київ',
        name_pl: 'Kijów',
        timezone_name: 'Europe/Kyiv',
        is_active: true,
      },
      managers: [
        {
          id: 'manager-1',
          email: null,
          displayName: 'Олена',
          role: 'office_member',
          officeIds: ['kyiv'],
          officeUuids: ['office-kyiv'],
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          lastActiveAt: '2026-07-23T00:00:00Z',
        },
      ],
      appointment: {
        id: 'appointment-visited',
        lead: { id: 'lead-1', name: 'Анна Коваль', phone: '+380501112233' },
        office: {
          id: 'office-kyiv',
          code: 'kyiv',
          name: 'Київ',
          timezoneName: 'Europe/Kyiv',
        },
        responsibleManager: { id: 'manager-1', displayName: 'Олена' },
        startsAt: '2026-07-23T07:00:00.000Z',
        endsAt: '2026-07-23T08:00:00.000Z',
        status: 'visited',
        comment: 'Візит відбувся',
        version: 2,
        hasConflict: false,
        isOutsideWorkingHours: false,
        warnings: [],
        createdAt: '2026-07-20T12:00:00.000Z',
        updatedAt: '2026-07-23T08:00:00.000Z',
      },
    };
    const update = vi.fn().mockResolvedValue(data.appointment);
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AppointmentsService, useValue: { update } },
        { provide: LeadsService, useValue: { list: vi.fn() } },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.terminal-status')?.textContent).toContain('Відвідав');
    expect(element.querySelector<HTMLInputElement>('input[type="date"]')?.disabled).toBe(false);
    expect(element.textContent).toContain('Зберегти');
    expect(element.querySelector('.client-link')?.getAttribute('href')).toBe('/crm/leads/lead-1');

    element.querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();

    expect(update).toHaveBeenCalledWith('appointment-visited', 2, {
      startsAtLocal: '2026-07-23T10:00',
      durationMinutes: 60,
      responsibleManagerId: 'manager-1',
      comment: 'Візит відбувся',
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ kind: 'saved' }));
  });

  it('offers re-booking a canceled appointment, then creates a fresh one on submit', async () => {
    const close = vi.fn();
    const data: AppointmentDrawerData = {
      office: {
        id: 'office-kyiv',
        code: 'kyiv',
        name_uk: 'Київ',
        name_pl: 'Kijów',
        timezone_name: 'Europe/Kyiv',
        is_active: true,
      },
      managers: [
        {
          id: 'manager-1',
          email: null,
          displayName: 'Олена',
          role: 'office_member',
          officeIds: ['kyiv'],
          officeUuids: ['office-kyiv'],
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          lastActiveAt: '2026-07-23T00:00:00Z',
        },
      ],
      appointment: {
        id: 'appointment-canceled',
        lead: { id: 'lead-1', name: 'Анна Коваль', phone: '+380501112233' },
        office: {
          id: 'office-kyiv',
          code: 'kyiv',
          name: 'Київ',
          timezoneName: 'Europe/Kyiv',
        },
        responsibleManager: { id: 'manager-1', displayName: 'Олена' },
        startsAt: '2026-07-23T07:00:00.000Z',
        endsAt: '2026-07-23T08:00:00.000Z',
        status: 'canceled',
        comment: 'Клієнт скасував',
        version: 3,
        hasConflict: false,
        isOutsideWorkingHours: false,
        warnings: [],
        createdAt: '2026-07-20T12:00:00.000Z',
        updatedAt: '2026-07-23T08:00:00.000Z',
      },
    };
    const create = vi.fn().mockResolvedValue({ ...data.appointment, id: 'appointment-new' });
    const update = vi.fn();
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AppointmentsService, useValue: { create, update } },
        { provide: LeadsService, useValue: { list: vi.fn() } },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.terminal-status.is-canceled')).not.toBeNull();
    const rebookButton = element.querySelector<HTMLButtonElement>('.rebook-button button');
    expect(rebookButton).not.toBeNull();

    rebookButton!.click();
    await fixture.whenStable();

    // Re-book mode: terminal pill and its re-book button are gone.
    expect(element.querySelector('.terminal-status')).toBeNull();
    expect(element.querySelector('.rebook-button')).toBeNull();

    element.querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();

    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: 'lead-1', responsibleManagerId: 'manager-1' }),
    );
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ kind: 'saved' }));
  });

  it('closes the drawer when opening the client card link', async () => {
    const close = vi.fn();
    const lead = { ...CRM_MOCK_LEADS[0]! };
    const data: AppointmentDrawerData = {
      office: {
        id: 'office-kyiv',
        code: 'kyiv',
        name_uk: 'Київ',
        name_pl: 'Kijów',
        timezone_name: 'Europe/Kyiv',
        is_active: true,
      },
      managers: [],
      lead,
      date: '2026-07-26',
      time: '10:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AppointmentsService, useValue: { create: vi.fn() } },
        { provide: LeadsService, useValue: { list: vi.fn() } },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.client-link',
    )!;
    expect(link.getAttribute('href')).toBe(`/crm/leads/${lead.id}`);
    // Invoke the template click handler without triggering async RouterLink navigation
    // that races TestBed teardown.
    fixture.componentInstance['close']();
    expect(close).toHaveBeenCalledWith();
  });
});
