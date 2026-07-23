import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';

import { SessionService } from '../../../core/session/session.service';
import { CRM_MOCK_LEADS } from '../../../services/crm-mock.data';
import type { MockLead } from '../../../services/crm-mock.types';
import { LeadsService } from '../../../services/leads.service';
import { EditLeadDialog } from './edit-lead-dialog';

describe('EditLeadDialog', () => {
  async function render(
    lead: MockLead = CRM_MOCK_LEADS[0]!,
    updateLeadDetails: ReturnType<typeof vi.fn> = vi.fn(async () => undefined),
  ) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EditLeadDialog],
      providers: [
        {
          provide: LeadsService,
          useValue: { updateLeadDetails },
        },
        {
          provide: SessionService,
          useValue: { locale: () => 'uk' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EditLeadDialog);
    fixture.componentRef.setInput('lead', lead);
    await fixture.whenStable();
    return { fixture, updateLeadDetails };
  }

  function inputByLabel(element: HTMLElement, text: string): HTMLInputElement | null {
    const label = Array.from(element.querySelectorAll('label')).find((candidate) =>
      candidate.textContent?.includes(text),
    );
    return label ? element.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : null;
  }

  it('prefills all editable lead fields without exposing manager editing', async () => {
    const lead = CRM_MOCK_LEADS[0]!;
    const { fixture } = await render(lead);
    const element = fixture.nativeElement as HTMLElement;

    expect(inputByLabel(element, 'Імʼя')?.value).toBe(lead.name);
    expect(inputByLabel(element, 'Телефон')?.value).toBe(lead.phone);
    expect(inputByLabel(element, 'Email')?.value).toBe(lead.email);
    expect(inputByLabel(element, 'Місто / район')?.value).toBe(lead.cityRegion);
    expect(inputByLabel(element, 'Продукт')?.value).toBe(lead.productInterest);
    expect(inputByLabel(element, 'Бюджет, EUR')?.value).toBe(String(lead.estimatedBudget));
    expect(element.querySelector('textarea')?.value).toBe(lead.initialMessage);
    expect(element.textContent).not.toContain('Менеджер');
  });

  it('normalizes values, preserves the manager and sends stable audit field keys', async () => {
    const lead = CRM_MOCK_LEADS[7]!;
    const { fixture, updateLeadDetails } = await render(lead);
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    fixture.componentInstance['model'].update((value) => ({
      ...value,
      phone: '883 000 111',
      email: '  nowy@example.com  ',
      cityRegion: '  Warszawa, Centrum  ',
      productInterest: '  Kuchnia  ',
      budget: '25 500,50',
      initialMessage: '  Proszę o kontakt  ',
    }));
    await fixture.componentInstance['save']();

    expect(updateLeadDetails).toHaveBeenCalledWith(
      lead.id,
      {
        name: lead.name,
        phone: '+48 883 000 111',
        email: 'nowy@example.com',
        cityRegion: 'Warszawa, Centrum',
        productInterest: 'Kuchnia',
        estimatedBudget: 25500.5,
        initialMessage: 'Proszę o kontakt',
        assignedToId: lead.assignedToId,
      },
      ['phone', 'email', 'cityRegion', 'product', 'budget', 'initialMessage'],
    );
    expect(saved).toHaveBeenCalledOnce();
  });

  it('dismisses without an API call when no values changed', async () => {
    const { fixture, updateLeadDetails } = await render();
    const dismissed = vi.fn();
    fixture.componentInstance.dismissed.subscribe(dismissed);

    await fixture.componentInstance['save']();

    expect(updateLeadDetails).not.toHaveBeenCalled();
    expect(dismissed).toHaveBeenCalledOnce();
  });

  it('shows field errors for invalid required, phone, email and budget values', async () => {
    const { fixture, updateLeadDetails } = await render();

    fixture.componentInstance['model'].update((value) => ({
      ...value,
      name: '  ',
      phone: '123',
      email: 'invalid-email',
      budget: '-1',
    }));
    await fixture.componentInstance['save']();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Вкажіть імʼя клієнта.');
    expect(element.textContent).toContain('Телефон має некоректний формат.');
    expect(element.textContent).toContain('Email має некоректний формат.');
    expect(element.textContent).toContain('Бюджет має бути додатним числом або порожнім.');
    expect(updateLeadDetails).not.toHaveBeenCalled();
  });

  it('prevents duplicate saves and keeps an API error in the open dialog', async () => {
    let rejectUpdate!: (reason: Error) => void;
    const updateLeadDetails = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectUpdate = reject;
        }),
    );
    const { fixture } = await render(CRM_MOCK_LEADS[0]!, updateLeadDetails);
    fixture.componentInstance['model'].update((value) => ({ ...value, name: 'Нове імʼя' }));

    const firstSave = fixture.componentInstance['save']();
    await vi.waitFor(() => expect(updateLeadDetails).toHaveBeenCalledOnce());
    await fixture.componentInstance['save']();
    expect(updateLeadDetails).toHaveBeenCalledOnce();

    rejectUpdate(new Error('Lead was changed by another user'));
    await firstSave;
    await fixture.whenStable();

    expect(fixture.componentInstance['error']()).toBe('Lead was changed by another user');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Lead was changed by another user',
    );
  });

  it('has no detectable accessibility violations', async () => {
    const { fixture } = await render();
    const results = await axe.run(fixture.nativeElement as HTMLElement);
    expect(results.violations).toEqual([]);
  });
});
