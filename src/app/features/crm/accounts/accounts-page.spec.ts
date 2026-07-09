import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionService } from '../../../core/session/session.service';
import { UsersService } from '../../../services/users.service';
import { AccountsPage } from './accounts-page';

describe('AccountsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsPage],
      providers: [
        provideRouter([]),
        {
          provide: SessionService,
          useValue: {
            officeContext: () => ({
              offices: [
                { id: 'office-kyiv', code: 'kyiv', name_uk: 'Київ', name_pl: 'Kijów', is_active: true },
                {
                  id: 'office-warsaw',
                  code: 'warsaw',
                  name_uk: 'Варшава',
                  name_pl: 'Warszawa',
                  is_active: true,
                },
              ],
            }),
            offices: () => [],
          },
        },
        {
          provide: UsersService,
          useValue: {
            listEmployees: async () => [
              {
                id: 'user-1',
                email: 'olena@kolss.com',
                displayName: 'Олена Коваль',
                role: 'super_admin',
                officeIds: ['kyiv', 'warsaw'],
                officeUuids: ['office-kyiv', 'office-warsaw'],
                status: 'active',
                createdAt: '2026-01-01T00:00:00.000Z',
                lastActiveAt: '2026-07-01T00:00:00.000Z',
              },
            ],
            listInactiveEmployees: async () => [
              {
                id: 'user-2',
                email: 'kyiv.office@kolss.in.ua',
                displayName: 'Київ Офіс',
                role: 'office_admin',
                officeIds: ['kyiv'],
                officeUuids: ['office-kyiv'],
                status: 'inactive',
                createdAt: '2024-06-08T00:00:00.000Z',
                lastActiveAt: '2024-06-08T00:00:00.000Z',
              },
            ],
          },
        },
      ],
    }).compileComponents();
  });

  it('renders grouped employee sections by role and office', async () => {
    const fixture = TestBed.createComponent(AccountsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Акаунти');
    expect(element.textContent).toContain('Олена Коваль');
    expect(element.textContent).toContain('Супер-адмін');
    expect(element.textContent).toContain('Супер адмін');
    expect(element.textContent).toContain('Адміни офісу');
    expect(element.textContent).toContain('Менеджери Київ');
    expect(element.textContent).toContain('Менеджери Варшава');
    expect(element.querySelector('section[aria-labelledby="accounts-super-admins"]')).toBeTruthy();
    expect(element.querySelector('section[aria-labelledby="accounts-inactive"]')).toBeTruthy();
    expect(element.textContent).toContain('Деактивовані акаунти');
    expect(element.textContent).toContain('Київ Офіс');
    expect(element.querySelectorAll('.accounts-sections .accounts-table-panel')).toHaveLength(4);
    expect(element.querySelectorAll('.accounts-table colgroup col')).toHaveLength(35);
    expect(
      element
        .querySelector('section[aria-labelledby="accounts-super-admins"] tbody')
        ?.querySelectorAll('tr'),
    ).toHaveLength(1);
  });
});
