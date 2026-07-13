import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { ImpersonationService } from '../../../core/auth/impersonation.service';
import { SessionService } from '../../../core/session/session.service';
import { CrmShell } from './crm-shell';

describe('CrmShell', () => {
  const impersonationActive = signal(false);

  beforeEach(async () => {
    impersonationActive.set(false);
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
            officeFilter: () => 'all',
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
            setOfficeFilter: vi.fn(),
            setLocale: vi.fn(),
          },
        },
      ],
    }).compileComponents();
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
    expect(left?.querySelector('.crm-shell__segmented--office')).toBeTruthy();
    expect(left?.querySelector('.crm-shell__segmented--language')).toBeTruthy();
    expect(user?.querySelector('.crm-shell__user-meta')).toBeTruthy();
    expect(user?.querySelector('app-ui-menu')).toBeTruthy();
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
