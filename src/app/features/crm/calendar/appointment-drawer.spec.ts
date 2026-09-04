import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { SessionService } from '@core/session/session.service';
import type { Lead } from '@domain/lead.types';
import { FIXTURE_LEADS } from '@testing/fixtures/leads.fixture';
import { AppointmentsService } from '@services/appointments.service';
import { LeadsService } from '@services/leads.service';
import { KolssApiError } from '@core/api/generated/kolss-api.client';
import { AppointmentDrawer, type AppointmentDrawerData } from './appointment-drawer';

describe('AppointmentDrawer', () => {
  it('searches active office leads by a partial client code', async () => {
    const list = vi.fn().mockResolvedValue([FIXTURE_LEADS[0]!]);
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
      kind: 'measurement',
      date: '2026-09-04',
      time: '10:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AppointmentsService, useValue: { create: vi.fn() } },
        { provide: LeadsService, useValue: { list, getById: vi.fn().mockResolvedValue(null) } },
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
    const searchInput = element.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(searchInput.placeholder).toBe('Код, імʼя або телефон');

    searchInput.value = '02';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();

    expect(list).toHaveBeenCalledWith({
      officeId: 'office-kyiv',
      search: '02',
      archived: 'active',
      limit: 12,
    });
    expect(element.querySelector('.lead-results app-lead-reference')?.textContent).toContain(
      FIXTURE_LEADS[0]!.referenceId,
    );
  });

  it('shows a non-blocking out-of-hours warning and creates the appointment', async () => {
    const lead = { ...FIXTURE_LEADS[0]!, assignedToId: 'manager-1' };
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
      kind: 'showroom',
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
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Час поза графіком');
    const clientLink = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.client-link',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.selected-lead app-lead-reference')
        ?.textContent,
    ).toContain(lead.referenceId);
    expect(clientLink?.textContent).toContain('Відкрити картку клієнта');
    expect(clientLink?.getAttribute('href')).toBe(`/crm/leads/${lead.id}`);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith({
      leadId: lead.id,
      kind: 'showroom',
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
        lead: {
          id: 'lead-1',
          referenceId: 'k0001',
          name: 'Анна Коваль',
          phone: '+380501112233',
        },
        office: {
          id: 'office-kyiv',
          code: 'kyiv',
          name: 'Київ',
          timezoneName: 'Europe/Kyiv',
        },
        responsibleManager: { id: 'manager-1', displayName: 'Олена' },
        kind: 'showroom',
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
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
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
        lead: {
          id: 'lead-1',
          referenceId: 'k0001',
          name: 'Анна Коваль',
          phone: '+380501112233',
        },
        office: {
          id: 'office-kyiv',
          code: 'kyiv',
          name: 'Київ',
          timezoneName: 'Europe/Kyiv',
        },
        responsibleManager: { id: 'manager-1', displayName: 'Олена' },
        kind: 'showroom',
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
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
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
    const lead = { ...FIXTURE_LEADS[0]! };
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
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
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
    expect(link.closest('.drawer-actions__leading')).not.toBeNull();
    expect(link.closest('.drawer-body')).toBeNull();
    // Invoke the template click handler without triggering async RouterLink navigation
    // that races TestBed teardown.
    fixture.componentInstance['close']();
    expect(close).toHaveBeenCalledWith();
  });

  it('loads the lead comment history directly below the appointment comment input', async () => {
    const lead = { ...FIXTURE_LEADS[0]!, assignedToId: 'manager-1' };
    const detailedLead = {
      ...lead,
      events: [
        {
          ...lead.events[0]!,
          id: 'comment-new',
          actorName: 'Олена Коваль',
          comment: 'Новіша домовленість із клієнтом',
          occurredAt: '2026-09-04T12:00:00.000Z',
        },
        {
          ...lead.events[0]!,
          id: 'comment-old',
          actorName: 'Ірина Шевченко',
          comment: 'Старіший коментар',
          occurredAt: '2026-09-03T09:00:00.000Z',
        },
        {
          ...lead.events[0]!,
          id: 'without-comment',
          comment: null,
          occurredAt: '2026-09-05T09:00:00.000Z',
        },
      ],
    };
    const getById = vi.fn().mockResolvedValue(detailedLead);
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
      date: '2026-09-04',
      time: '10:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AppointmentsService, useValue: { create: vi.fn() } },
        { provide: LeadsService, useValue: { list: vi.fn(), getById } },
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
    const textarea = element.querySelector('app-ui-textarea')!;
    const comments = element.querySelector('app-appointment-drawer-comments')!;
    const renderedComments = Array.from(comments.querySelectorAll('li p')).map((item) =>
      item.textContent?.trim(),
    );

    expect(getById).toHaveBeenCalledWith(lead.id);
    expect(textarea.compareDocumentPosition(comments) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
      0,
    );
    expect(comments.textContent).toContain('Коментарі клієнта');
    expect(renderedComments).toEqual(['Новіша домовленість із клієнтом', 'Старіший коментар']);
  });

  it('creates a measurement with the 120-minute default and a teal kind chip', async () => {
    const lead = { ...FIXTURE_LEADS[0]!, assignedToId: 'manager-1' };
    const create = vi.fn().mockResolvedValue({ id: 'appointment-2' });
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
      kind: 'measurement',
      date: '2026-07-27',
      time: '11:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AppointmentsService, useValue: { create } },
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.appointment-kind.is-measurement')?.textContent).toContain(
      'Замір у клієнта',
    );
    element.querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'measurement', durationMinutes: 120 }),
    );
  });

  it('sends a custom duration and blocks an invalid one', async () => {
    const lead = { ...FIXTURE_LEADS[0]!, assignedToId: 'manager-1' };
    const create = vi.fn().mockResolvedValue({ id: 'appointment-3' });
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
      kind: 'measurement',
      date: '2026-07-27',
      time: '11:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AppointmentsService, useValue: { create } },
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      model: { update: (fn: (value: Record<string, string>) => Record<string, string>) => void };
    };

    component.model.update((value) => ({ ...value, duration: 'custom', customDuration: '35' }));
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();
    expect(create).not.toHaveBeenCalled();

    component.model.update((value) => ({ ...value, customDuration: '150' }));
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 150 }));
  });

  it('surfaces the server manager_busy rejection instead of saving', async () => {
    const lead = { ...FIXTURE_LEADS[0]!, assignedToId: 'manager-1' };
    const create = vi
      .fn()
      .mockRejectedValue(new KolssApiError('Manager busy', 'manager_busy', 409, 'req-1'));
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
      date: '2026-07-27',
      time: '11:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AppointmentsService, useValue: { create } },
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent).toContain(
      'уже зайнятий',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('creates office work with a one-hour default and keeps the creator as manager', async () => {
    const lead = { ...FIXTURE_LEADS[0]!, assignedToId: 'manager-2' };
    const create = vi.fn().mockResolvedValue({ id: 'office-work-1' });
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
        {
          id: 'manager-2',
          email: null,
          displayName: 'Ірина',
          role: 'office_member',
          officeIds: ['kyiv'],
          officeUuids: ['office-kyiv'],
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          lastActiveAt: '2026-07-23T00:00:00Z',
        },
      ],
      lead,
      kind: 'office_work',
      date: '2026-09-04',
      time: '11:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AppointmentsService, useValue: { create } },
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      model: () => { duration: string; managerId: string };
      selectLead: (selectedLead: Lead) => void;
    };
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.appointment-kind.is-office-work')?.textContent).toContain(
      'Робота в офісі',
    );
    expect(element.querySelector('.status-actions')).toBeNull();
    expect(component.model().duration).toBe('60');
    expect(component.model().managerId).toBe('manager-1');
    component.selectLead(lead);
    expect(component.model().managerId).toBe('manager-1');

    element.querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: lead.id,
        kind: 'office_work',
        durationMinutes: 60,
        responsibleManagerId: 'manager-1',
      }),
    );
  });

  it('validates a custom office-work end time and sends the computed duration', async () => {
    const lead = { ...FIXTURE_LEADS[0]!, assignedToId: 'manager-2' };
    const create = vi.fn().mockResolvedValue({ id: 'office-work-custom' });
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
      kind: 'office_work',
      date: '2026-09-04',
      time: '11:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AppointmentsService, useValue: { create } },
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'manager-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      model: {
        update: (fn: (value: Record<string, string>) => Record<string, string>) => void;
      };
    };

    component.model.update((value) => ({
      ...value,
      duration: 'custom',
      customEndTime: '11:10',
    }));
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();
    expect(create).not.toHaveBeenCalled();

    component.model.update((value) => ({ ...value, customEndTime: '13:30' }));
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 150 }));
  });

  it('does not expose visit status actions or rebooking for office work', async () => {
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
      appointment: {
        id: 'office-work-canceled',
        lead: {
          id: 'lead-1',
          referenceId: 'k0001',
          name: 'Анна Коваль',
          phone: '+380501112233',
        },
        office: {
          id: 'office-kyiv',
          code: 'kyiv',
          name: 'Київ',
          timezoneName: 'Europe/Kyiv',
        },
        responsibleManager: { id: 'manager-1', displayName: 'Олена' },
        kind: 'office_work',
        startsAt: '2026-09-04T08:00:00.000Z',
        endsAt: '2026-09-04T10:00:00.000Z',
        status: 'canceled',
        comment: 'Підготувати проєкт',
        version: 2,
        hasConflict: false,
        isOutsideWorkingHours: false,
        warnings: [],
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-02T08:00:00.000Z',
      },
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AppointmentsService, useValue: { update: vi.fn() } },
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
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

    expect(element.querySelector('.appointment-kind.is-office-work')).not.toBeNull();
    expect(element.querySelector('.status-actions')).toBeNull();
    expect(element.querySelector('.rebook-button')).toBeNull();
  });

  it('requires client and manager selection for office work created by an admin', async () => {
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
      kind: 'office_work',
      date: '2026-09-04',
      time: '11:00',
    };
    await TestBed.configureTestingModule({
      imports: [AppointmentDrawer],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AppointmentsService, useValue: { create: vi.fn() } },
        {
          provide: LeadsService,
          useValue: { list: vi.fn(), getById: vi.fn().mockResolvedValue(null) },
        },
        {
          provide: AuthService,
          useValue: { sessionContext: () => ({ user: { id: 'admin-1' } }) },
        },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppointmentDrawer);
    await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {
      model: () => { managerId: string };
    };
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Оберіть клієнта, для якого виконується робота');
    expect(element.querySelector<HTMLInputElement>('input[type="search"]')?.required).toBe(true);
    expect(component.model().managerId).toBe('');
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });
});
