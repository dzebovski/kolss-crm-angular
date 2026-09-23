import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import axe from 'axe-core';

import { AuthService } from '@core/auth/auth.service';
import { ImpersonationService } from '@core/auth/impersonation.service';
import { SessionService } from '@core/session/session.service';
import type { OfficeFilter } from '@domain/office.types';
import { CrmShell } from './crm-shell';

@Component({ template: '' })
class RoutedStub {}

describe('CrmShell', () => {
  const impersonationActive = signal(false);
  const isSuperAdmin = signal(true);
  const officeFilter = signal<OfficeFilter>('all');
  const setOfficeFilter = vi.fn((filter: OfficeFilter) => officeFilter.set(filter));

  beforeEach(async () => {
    impersonationActive.set(false);
    isSuperAdmin.set(true);
    officeFilter.set('all');
    setOfficeFilter.mockClear();
    await TestBed.configureTestingModule({
      imports: [CrmShell],
      providers: [
        provideRouter([{ path: 'reports/sales-funnel', component: RoutedStub }]),
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
              isSuperAdmin: isSuperAdmin(),
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

  it('keeps compact navigation left and moves office controls to the right cluster', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const header = element.querySelector('.crm-shell__header');
    const headerContainer = header?.querySelector('.crm-shell__header-container');
    const left = element.querySelector('.crm-shell__left');
    const actions = element.querySelector('.crm-shell__actions');
    const user = element.querySelector('.crm-shell__user');

    expect(headerContainer).toBeTruthy();
    expect(headerContainer?.parentElement).toBe(header);
    expect(left?.querySelector('.crm-shell__brand')).toBeTruthy();
    expect(left?.querySelector('.crm-shell__navigation-trigger')).toBeTruthy();
    expect(left?.querySelector('app-ui-picker')).toBeNull();
    expect(actions?.querySelector('app-ui-picker')).toBeTruthy();
    expect(element.querySelector('.global-navigation__footer app-ui-picker')).toBeTruthy();
    expect(user?.querySelector('.crm-shell__user-meta')).toBeTruthy();
    expect(user?.querySelector('app-ui-menu')).toBeTruthy();
    expect(user?.querySelector('.ui-menu__trigger-label')?.textContent?.trim()).toBe(
      'Налаштування',
    );
  });

  it('opens the navigation drawer and exposes every allowed destination', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('.crm-shell__navigation-trigger') as HTMLButtonElement;

    trigger.focus();
    trigger.click();
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.global-navigation--open')).toBeTruthy();
    expect(element.querySelector('.crm-shell__main')?.hasAttribute('inert')).toBe(true);
    expect(getComputedStyle(document.documentElement).overflow).toBe('hidden');
    expect(getComputedStyle(document.body).overflow).not.toBe('hidden');

    const items = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.global-navigation__nav a'),
    );
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Дешборд',
      'Ліди',
      'Проєкти',
      'Клієнти',
      'Розклад',
      'Звітність',
      'Звітність по лідах',
      'Звітність по воронці',
      'Акаунти та налаштування',
      'Акаунти',
      'Налаштування',
    ]);
    expect(items.every((item) => item.querySelector('app-ui-icon'))).toBe(true);
  });

  it('closes the drawer with Escape and restores focus to the trigger', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('.crm-shell__navigation-trigger') as HTMLButtonElement;

    trigger.click();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(document.documentElement.classList.contains('crm-navigation-open')).toBe(false);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('hides accounts and settings navigation without the server-issued capability', async () => {
    isSuperAdmin.set(false);
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.global-navigation__nav a'),
      (link) => link.getAttribute('href'),
    );
    expect(hrefs.some((href) => href?.startsWith('/accounts'))).toBe(false);
    expect(hrefs).toContain('/projects');
    expect(hrefs).toContain('/clients');
  });

  it('marks the active child and its parent section after navigation', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector('.crm-shell__navigation-trigger') as HTMLButtonElement;
    trigger.click();
    await fixture.whenStable();

    await TestBed.inject(Router).navigateByUrl('/reports/sales-funnel');
    await fixture.whenStable();

    const parent = element.querySelector<HTMLAnchorElement>('a[href="/reports"]');
    const child = element.querySelector<HTMLAnchorElement>('a[href="/reports/sales-funnel"]');
    expect(parent?.classList.contains('global-navigation__link--ancestor')).toBe(true);
    expect(parent?.hasAttribute('aria-current')).toBe(false);
    expect(child?.classList.contains('global-navigation__child--current')).toBe(true);
    expect(child?.getAttribute('aria-current')).toBe('page');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('has no automated accessibility violations while the drawer is open', async () => {
    const fixture = TestBed.createComponent(CrmShell);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    (element.querySelector('.crm-shell__navigation-trigger') as HTMLButtonElement).click();
    await fixture.whenStable();

    const results = await axe.run(element, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
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
