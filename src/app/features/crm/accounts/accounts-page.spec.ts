import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UsersService } from '../../../services/users.service';
import { AccountsPage } from './accounts-page';

describe('AccountsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsPage],
      providers: [
        provideRouter([]),
        {
          provide: UsersService,
          useValue: {
            listEmployees: async () => [
              {
                id: 'user-1',
                displayName: 'Олена Коваль',
                role: 'super_admin',
                officeIds: ['kyiv', 'warsaw'],
                status: 'active',
                createdAt: '2026-01-01T00:00:00.000Z',
                lastActiveAt: '2026-07-01T00:00:00.000Z',
              },
            ],
          },
        },
      ],
    }).compileComponents();
  });

  it('renders employees, roles, offices and account states', async () => {
    const fixture = TestBed.createComponent(AccountsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Акаунти');
    expect(element.textContent).toContain('Олена Коваль');
    expect(element.textContent).toContain('Супер-адмін');
    expect(element.textContent).toContain('Варшава');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});
