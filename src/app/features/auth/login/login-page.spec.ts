import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionService } from '../../../core/session/session.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  const setLocale = vi.fn();

  beforeEach(async () => {
    setLocale.mockReset();
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
        {
          provide: SessionService,
          useValue: {
            locale: () => 'en',
            setLocale,
          },
        },
      ],
    }).compileComponents();
  });

  it('renders English sign-in copy and the language switcher', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('CRM Login');
    expect(element.textContent).toContain('Email and password');
    expect(element.querySelector('a[routerlink="/design"]')).toBeNull();
    expect(element.querySelector('.login-card__back')).toBeNull();
    expect(element.querySelector('.login-language')).toBeTruthy();
    expect(element.querySelectorAll('.login-language button')).toHaveLength(3);
    expect(element.textContent).toContain('EN');
    expect(element.textContent).toContain('PL');
    expect(element.textContent).toContain('UA');
    expect(element.querySelector<HTMLInputElement>('input[type="email"]')).toBeTruthy();
    expect(element.querySelector<HTMLInputElement>('input[type="password"]')).toBeTruthy();
  });

  it('persists locale through SessionService when a language is selected', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.login-language button',
      ),
    );
    const plButton = buttons.find((button) => button.textContent?.trim() === 'PL');
    expect(plButton).toBeTruthy();
    plButton?.click();

    expect(setLocale).toHaveBeenCalledWith('pl');
  });
});
