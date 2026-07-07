import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            signIn: vi.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the redesigned email and password sign in form', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Вхід до CRM');
    expect(element.textContent).toContain('Пошта і пароль');
    expect(element.querySelector<HTMLInputElement>('input[type="email"]')).toBeTruthy();
    expect(element.querySelector<HTMLInputElement>('input[type="password"]')).toBeTruthy();
  });
});
