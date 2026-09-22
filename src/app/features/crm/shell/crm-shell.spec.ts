import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { ImpersonationService } from '@core/auth/impersonation.service';
import { SessionService } from '@core/session/session.service';
import type { OfficeFilter } from '@domain/office.types';
import { CrmShell } from './crm-shell';

describe('CrmShell', () => {
  const impersonationActive = signal(false);
  const officeFilter = signal<OfficeFilter>('all');
  const setOfficeFilter = vi.fn((filter: OfficeFilter) => officeFilter.set(filter));

  beforeEach(async () => {
    impersonationActive.set(false);
    officeFilter.set('all');
    setOfficeFilter.mockClear();
    await TestBed.configureTestingModule({
      imports: [CrmShell],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            profile: () => ({
              id: 'user-1',
              role: 'super_admin',
              display_name: 'Oleksandr',
              is_active: true,
              deactivated_at: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            }),
            session: () => null,
            sessionContext: () => null,
            signOut: async () => undefined,
          },
        },
        {
          provide: ImpersonationService,
          useValue: {
            isActive: impersonationActive.asReadonly(),
            targetUserId: () => (impersonationActive() ? 'manager-1' : null),
            start: vi.fn(),
            stop: vi.fn(),
            clear: vi.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            showOfficeFilter: () => true,
            officeFilter,
            locale: () => 'uk',
            officeContext: () => ({
              isSuperAdmin: true,
              canFilter: true,
              canUseOfficeFilter: true,
              offices: [],
              userOffices: [],
              filterOffices: [
                {
                  id: 'office-kyiv',
                  code: 'kyiv',
                  name_uk: 'Київ',
                  name_pl: 'Kijow',
                  is_active: true,
                },
                {
                  id: 'office-warsaw',
                  code: 'warsaw',
                  name_uk: 'Варшава',
                  name_pl: 'Warszawa',
                  is_active: true,
                },
              ],
            }),
            setOfficeFilter,
            setLocale: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  it('keeps navigation and context controls in the left cluster', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const left = element.querySelector('.crm-shell__left');
    const user = element.querySelector('.crm-shell__user');

    expect(left?.querySelector('.crm-shell__brand')).toBeTruthy();
    expect(left?.querySelector('.crm-shell__nav')).toBeTruthy();
    expect(left?.querySelector('app-ui-picker')).toBeTruthy();
    expect(user?.querySelector('.crm-shell__user-meta')).toBeTruthy();
    expect(user?.querySelector('app-ui-menu')).toBeTruthy();
  });

  it('renders localized office options and delegates the selected office', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    const overlayContainer = TestBed.inject(OverlayContainer);
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('app-ui-picker button') as HTMLButtonElement;

    expect(trigger.textContent).toContain('Усі офіси');
    expect(trigger.getAttribute('aria-label')).toBe('Офісний контекст');
    expect(trigger.getAttribute('aria-disabled')).toBe('false');

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const renderedOptions = Array.from(
      overlayContainer.getContainerElement().querySelectorAll<HTMLElement>('[role="option"]'),
    );
    expect(
      renderedOptions.map((option) => option.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['Усі офіси', '🇺🇦Київ', '🇵🇱Варшава']);

    renderedOptions.find((option) => option.textContent?.includes('Київ'))?.click();
    await fixture.whenStable();

    expect(setOfficeFilter).toHaveBeenCalledWith('kyiv');
    expect(trigger.textContent).toContain('Київ');
  });

  it('lists language options in the user menu', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();

    const labels = fixture.componentInstance['userMenuItems']()
      .filter((item) => item.value.startsWith('locale:'))
      .map((item) => item.label);

    expect(labels).toEqual(['English', 'Polski', 'Українська']);
  });

  it('offers login-as for super admin when not impersonating', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    fixture.detectChanges();

    const items = fixture.componentInstance['userMenuItems']();
    expect(items.some((item) => item.value === 'login-as')).toBe(true);
    expect(items.some((item) => item.value === 'stop-impersonation')).toBe(false);
  });

  it('shows impersonation banner and return menu while impersonating', async () => {
    impersonationActive.set(true);
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.crm-shell__impersonation')).toBeTruthy();

    const items = fixture.componentInstance['userMenuItems']();
    expect(items.some((item) => item.value === 'stop-impersonation')).toBe(true);
    expect(items.some((item) => item.value === 'login-as')).toBe(false);
  });
});
