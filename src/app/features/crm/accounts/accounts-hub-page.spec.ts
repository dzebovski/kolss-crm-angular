import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';

import { setActiveLocale } from '@core/i18n/locale-storage';
import { AccountsHubPage } from './accounts-hub-page';

describe('AccountsHubPage', () => {
  beforeEach(async () => {
    setActiveLocale('uk');
    await TestBed.configureTestingModule({
      imports: [AccountsHubPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('routes administrators to accounts and settings', async () => {
    const fixture = TestBed.createComponent(AccountsHubPage);
    await fixture.whenStable();
    const links = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a'),
    ];

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Accounts and settings');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/crm/accounts/users',
      '/crm/accounts/settings',
    ]);
  });

  it('passes an automated accessibility scan', async () => {
    const fixture = TestBed.createComponent(AccountsHubPage);
    await fixture.whenStable();

    const result = await axe.run(fixture.nativeElement as HTMLElement, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
