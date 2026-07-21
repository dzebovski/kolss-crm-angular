import { TestBed } from '@angular/core/testing';

import { setActiveLocale } from '../../../core/i18n/locale-storage';
import { SessionService } from '../../../core/session/session.service';
import { LeadsService } from '../../../services/leads.service';
import { CREATE_LEAD_NOW, CreateLeadDialog } from './create-lead-dialog';

describe('CreateLeadDialog', () => {
  const kyivOffice = {
    id: 'office-kyiv',
    code: 'kyiv',
    name_uk: 'Київ',
    name_pl: 'Kijów',
    is_active: true,
  };
  const warsawOffice = {
    id: 'office-warsaw',
    code: 'warsaw',
    name_uk: 'Варшава',
    name_pl: 'Warszawa',
    is_active: true,
  };

  beforeEach(async () => {
    setActiveLocale('uk');
    await TestBed.configureTestingModule({
      imports: [CreateLeadDialog],
      providers: [
        {
          provide: CREATE_LEAD_NOW,
          useValue: () => new Date('2026-07-20T21:30:00.000Z'),
        },
        {
          provide: SessionService,
          useValue: {
            locale: () => 'uk',
            officeContext: () => ({
              filterOffices: [kyivOffice, warsawOffice],
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

  it('defaults to today in the selected office and noon', async () => {
    const fixture = TestBed.createComponent(CreateLeadDialog);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const dateInput = element.querySelector<HTMLInputElement>('input[type="date"]');
    const timeInput = element.querySelector<HTMLInputElement>('input[type="time"]');

    expect(dateInput?.value).toBe('2026-07-21');
    expect(dateInput?.required).toBe(true);
    expect(timeInput?.value).toBe('12:00');
    expect(timeInput?.required).toBe(true);
  });

  it('updates an untouched default date when the office changes', async () => {
    const fixture = TestBed.createComponent(CreateLeadDialog);
    await fixture.whenStable();

    fixture.componentInstance['changeOffice'](warsawOffice.id);
    expect(fixture.componentInstance['sourceDate']()).toBe('2026-07-20');

    fixture.componentInstance['changeSourceDate']('2026-06-15');
    fixture.componentInstance['changeOffice'](kyivOffice.id);
    expect(fixture.componentInstance['sourceDate']()).toBe('2026-06-15');
  });

  it('keeps submit enabled and shows field errors on click', async () => {
    const fixture = TestBed.createComponent(CreateLeadDialog);
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const submitButton = element.querySelector(
      'app-ui-button:last-of-type button',
    ) as HTMLButtonElement;
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
        sourceCreatedAtLocal: '2026-07-21T12:00',
      }),
    );
  });

  it('rejects missing or invalid lead date and time', async () => {
    const createLead = TestBed.inject(LeadsService).createLead as ReturnType<typeof vi.fn>;
    const fixture = TestBed.createComponent(CreateLeadDialog);
    await fixture.whenStable();

    fixture.componentInstance['name'].set('Марина');
    fixture.componentInstance['phone'].set('0672148819');
    fixture.componentInstance['changeSourceDate']('');
    fixture.componentInstance['changeSourceTime']('25:00');

    await fixture.componentInstance['submit']();

    expect(fixture.componentInstance['sourceDateError']()).toBe('Вкажіть дату ліда.');
    expect(fixture.componentInstance['sourceTimeError']()).toBe('Час має некоректний формат.');
    expect(createLead).not.toHaveBeenCalled();
  });
});
