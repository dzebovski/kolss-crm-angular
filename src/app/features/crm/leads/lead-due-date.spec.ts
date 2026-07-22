import { TestBed } from '@angular/core/testing';

import { SessionService } from '../../../core/session/session.service';
import { LeadDueDate } from './lead-due-date';

describe('LeadDueDate', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SessionService, useValue: { locale: () => 'uk' } }],
    });
  });

  it('renders a semantic compact status date without a year', async () => {
    const fixture = TestBed.createComponent(LeadDueDate);
    fixture.componentRef.setInput('date', '2026-07-22T12:00:00.000Z');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('До 22.07');
    expect(element.textContent).not.toContain('2026');
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-07-22T12:00:00.000Z',
    );
    expect(element.querySelector('app-ui-icon')).toBeTruthy();
    expect(element.getAttribute('data-kind')).toBe('status');
    expect(getComputedStyle(element).display).toBe('flex');
    expect(getComputedStyle(element).fontSize).toBe('0.6875rem');
  });

  it('uses the concise reminder copy for comment dates', async () => {
    const fixture = TestBed.createComponent(LeadDueDate);
    fixture.componentRef.setInput('date', '2026-07-22T12:00:00.000Z');
    fixture.componentRef.setInput('kind', 'comment');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Нагадування до 22.07');
    expect(element.textContent).not.toContain('2026');
    expect(element.getAttribute('data-kind')).toBe('comment');
  });
});
