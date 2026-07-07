import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AccountsPage } from './accounts-page';

describe('AccountsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountsPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders mock employees, roles, offices and account states', async () => {
    const fixture = TestBed.createComponent(AccountsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Акаунти');
    expect(element.textContent).toContain('Олена Коваль');
    expect(element.textContent).toContain('Супер-адмін');
    expect(element.textContent).toContain('Варшава');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(9);
  });
});
