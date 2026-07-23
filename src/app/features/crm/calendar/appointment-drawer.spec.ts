import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

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
});
