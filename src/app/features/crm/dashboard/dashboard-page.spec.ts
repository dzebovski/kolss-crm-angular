import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import axe from 'axe-core';
import { of } from 'rxjs';

import { KolssApiClient } from '../../../core/api/generated/kolss-api.client';
import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_EMPLOYEES, CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import { LeadsService } from '../../../services/leads.service';
import { UsersService } from '../../../services/users.service';
import { UiDialogService } from '../../../ui/dialog/ui-dialog';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage lead workflow', () => {
  async function render(
    drawerResult?: { dirty: boolean },
    leadOverrides: Partial<(typeof CRM_MOCK_LEADS)[number]> = {},
  ) {
    const lead = { ...CRM_MOCK_LEADS[0]!, ...leadOverrides, markers: [] };
    const setMarker = vi.fn().mockResolvedValue({
      kind: 'reviewed',
      actorId: 'user-1',
      actorName: 'Олена',
      markedAt: '2026-07-17T12:00:00.000Z',
    });
    const dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(drawerResult) });
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: { selectedOfficeId: () => null, locale: () => 'uk' },
        },
        {
          provide: KolssApiClient,
          useValue: {
            dashboard: vi.fn().mockResolvedValue({
              totalLeads: 1,
              activeLeads: 1,
              successfulLeads: 0,
              employees: 1,
            }),
          },
        },
        {
          provide: LeadsService,
          useValue: {
            list: vi.fn().mockResolvedValue([lead]),
            setMarker,
            deleteMarker: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UsersService,
          useValue: { listManagers: vi.fn().mockResolvedValue(CRM_MOCK_EMPLOYEES) },
        },
        { provide: UiDialogService, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    return { dialogOpen, fixture, setMarker };
  }

  it('opens the detail drawer without navigating away from dashboard', async () => {
    const { dialogOpen, fixture } = await render();
    const router = TestBed.inject(Router);
    const openButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.lead-open',
    );
    openButton!.click();
    await fixture.whenStable();

    expect(dialogOpen).toHaveBeenCalledOnce();
    expect(dialogOpen.mock.calls[0]![1]).toMatchObject({
      position: { top: '0', right: '0' },
      height: '100dvh',
    });
    expect(router.url).toBe('/');
  });

  it('toggles a marker without opening the lead', async () => {
    const { dialogOpen, fixture, setMarker } = await render();
    const reviewed = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[aria-label*="Перевірено"]',
    );
    reviewed!.click();
    await fixture.whenStable();

    expect(setMarker).toHaveBeenCalledWith(CRM_MOCK_LEADS[0]!.id, 'reviewed');
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(reviewed!.getAttribute('aria-pressed')).toBe('true');
  });

  it('restores the dashboard position and lead focus after a dirty close', async () => {
    const { fixture } = await render({ dirty: true });
    let afterRender: FrameRequestCallback | undefined;
    const animationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        afterRender = callback;
        return 1;
      });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const openButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.lead-open',
    )!;

    openButton.click();
    await fixture.whenStable();
    afterRender?.(0);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    expect(document.activeElement).toBe(openButton);
    animationFrame.mockRestore();
    scrollTo.mockRestore();
  });

  it('has no automated accessibility violations in the reminder list', async () => {
    const { fixture } = await render();
    const reminders = (fixture.nativeElement as HTMLElement).querySelector('.reminders')!;
    expect((await axe.run(reminders)).violations).toEqual([]);
  });

  it('shows the selected date next to callback and waiting statuses', async () => {
    const { fixture } = await render(undefined, {
      callStatus: 'callback_requested',
      clientStatus: 'thinking',
      callbackDueAt: '2026-07-25T12:00:00.000Z',
    });
    const meta = (fixture.nativeElement as HTMLElement).querySelector('.lead-meta');

    expect(meta?.textContent).toContain('Передзвонити');
    expect(meta?.textContent).toContain('Думає');
    expect(meta?.textContent).toContain('До 25.07');
    expect(meta?.textContent).not.toContain('2026');
  });

  it('shows a dated showroom status with the shared compact treatment', async () => {
    const { fixture } = await render(undefined, {
      callStatus: 'reached',
      clientStatus: 'showroom_invited',
      callbackDueAt: '2026-08-03T12:00:00.000Z',
      callbackDueContext: { category: 'client_status', statusCode: 'showroom_invited' },
    });
    const meta = (fixture.nativeElement as HTMLElement).querySelector('.lead-meta');

    expect(meta?.textContent).toContain('Запрошено в салон');
    expect(meta?.textContent).toContain('До 03.08');
    expect(meta?.textContent).not.toContain('2026');
  });
});
