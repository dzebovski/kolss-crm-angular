import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';

import { LeadMarkerToggles } from './lead-marker-toggles';

describe('LeadMarkerToggles', () => {
  it('exposes independent pressed states and emits the selected marker', async () => {
    const fixture = TestBed.createComponent(LeadMarkerToggles);
    fixture.componentRef.setInput('markers', [
      {
        kind: 'reviewed',
        actorId: 'user-1',
        actorName: 'Олена',
        markedAt: '2026-07-17T12:00:00.000Z',
      },
    ]);
    const toggled = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggled);
    await fixture.whenStable();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(buttons[0]!.textContent).toContain('Перевірено');
    expect(buttons[1]!.textContent).not.toContain('На контролі');
    buttons[1]!.click();
    expect(toggled).toHaveBeenCalledWith('manager_aware');
  });

  it('shows the compact label only next to an active marker', async () => {
    const fixture = TestBed.createComponent(LeadMarkerToggles);
    fixture.componentRef.setInput('markers', [
      {
        kind: 'manager_aware',
        actorId: 'user-2',
        actorName: 'Ірина',
        markedAt: '2026-07-17T12:00:00.000Z',
      },
    ]);
    await fixture.whenStable();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    expect(buttons[0]!.textContent).not.toContain('Перевірено');
    expect(buttons[1]!.textContent).toContain('На контролі');
  });

  it('has no automated accessibility violations', async () => {
    const fixture = TestBed.createComponent(LeadMarkerToggles);
    await fixture.whenStable();
    expect((await axe.run(fixture.nativeElement)).violations).toEqual([]);
  });
});
