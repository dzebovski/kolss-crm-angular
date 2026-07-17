import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_EMPLOYEES, CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import { LeadActivitiesService } from '../../../services/lead-activities.service';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { LeadDetailDrawer, type LeadDetailDrawerState } from './lead-detail-drawer';

describe('LeadDetailDrawer', () => {
  async function render() {
    const state: LeadDetailDrawerState = { dirty: false };
    const close = vi.fn();
    const leads = CRM_MOCK_LEADS.slice(0, 2);
    await TestBed.configureTestingModule({
      imports: [LeadDetailDrawer],
      providers: [
        provideRouter([]),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            leadIds: leads.map((lead) => lead.id),
            initialLeadId: leads[0]!.id,
            state,
          },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthService, useValue: { profile: () => ({ role: 'office_member' }) } },
        { provide: SessionService, useValue: { locale: () => 'uk' } },
        {
          provide: LeadsService,
          useValue: {
            getById: async (id: string) => leads.find((lead) => lead.id === id) ?? null,
            setMarker: vi.fn(),
            deleteMarker: vi.fn(),
            updateLeadDetails: vi.fn(),
          },
        },
        {
          provide: LeadActivitiesService,
          useValue: {
            recordCall: vi.fn(),
            addComment: vi.fn(),
            setClientStatus: vi.fn(),
            closeLead: vi.fn(),
            signContract: vi.fn(),
            reopen: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: { listManagers: async () => CRM_MOCK_EMPLOYEES },
        },
        { provide: UiDialogService, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LeadDetailDrawer);
    await fixture.whenStable();
    return { close, fixture, leads, state };
  }

  it('navigates through the fixed lead snapshot and disables boundary actions', async () => {
    const { fixture, leads } = await render();
    const element = fixture.nativeElement as HTMLElement;
    const previous = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Попередній лід"]',
    )!;
    const next = element.querySelector<HTMLButtonElement>('button[aria-label="Наступний лід"]')!;

    expect(previous.disabled).toBe(true);
    expect(element.textContent).toContain(leads[0]!.name);
    next.click();
    await fixture.whenStable();

    expect(element.textContent).toContain('2 / 2');
    expect(element.textContent).toContain(leads[1]!.name);
    expect(next.disabled).toBe(true);
  });

  it('returns dirty state when closed after a child change', async () => {
    const { close, fixture, state } = await render();
    fixture.componentInstance['markDirty']();
    fixture.componentInstance['close']();
    expect(state.dirty).toBe(true);
    expect(close).toHaveBeenCalledWith({ dirty: true });
  });

  it('has no automated accessibility violations', async () => {
    const { fixture } = await render();
    expect((await axe.run(fixture.nativeElement)).violations).toEqual([]);
  });
});
