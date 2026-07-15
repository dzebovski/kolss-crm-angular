import { TestBed } from '@angular/core/testing';

import { setActiveLocale } from '../../../core/i18n/locale-storage';
import { SessionService } from '../../../core/session/session.service';
import { LeadsService } from '../../../services/leads.service';
import { CreateLeadDialog } from './create-lead-dialog';

describe('CreateLeadDialog', () => {
  const kyivOffice = {
    id: 'office-kyiv',
    code: 'kyiv',
    name_uk: 'Київ',
    name_pl: 'Kijów',
    is_active: true,
  };

  beforeEach(async () => {
    setActiveLocale('uk');
    await TestBed.configureTestingModule({
      imports: [CreateLeadDialog],
      providers: [
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            officeContext: () => ({
              filterOffices: [kyivOffice],
            }),
            selectedOfficeId: () => kyivOffice.id,
          },
        },
        {
          provide: LeadsService,
          useValue: {
            createLead: vi.fn(async () => ({ id: 'lead-new-1' })),
          },
        },
      ],
    }).compileComponents();
  });

  it('keeps submit enabled and shows field errors on click', async () => {
    const fixture = TestBed.createComponent(CreateLeadDialog);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const submitButton = element.querySelector('app-ui-button:last-of-type button') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);

    fixture.componentInstance['name'].set('Марина');
    await fixture.componentInstance['submit']();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance['phoneError']()).toBe('Вкажіть телефон клієнта.');
    expect(element.textContent).toContain('Вкажіть телефон клієнта.');
    expect(TestBed.inject(LeadsService).createLead).not.toHaveBeenCalled();
  });

  it('normalizes phone before create and rejects invalid numbers', async () => {
    const createLead = TestBed.inject(LeadsService).createLead as ReturnType<typeof vi.fn>;
    const fixture = TestBed.createComponent(CreateLeadDialog);
    await fixture.whenStable();

    fixture.componentInstance['name'].set('Марина');
    fixture.componentInstance['phone'].set('123');
    await fixture.whenStable();

    await fixture.componentInstance['submit']();
    await fixture.whenStable();
    expect(fixture.componentInstance['phoneError']()).toBe('Телефон має некоректний формат.');
    expect(createLead).not.toHaveBeenCalled();

    fixture.componentInstance['phone'].set('0672148819');
    await fixture.whenStable();
    await fixture.componentInstance['submit']();
    await fixture.whenStable();

    expect(createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+38 067 2148819',
        name: 'Марина',
      }),
    );
  });
});
