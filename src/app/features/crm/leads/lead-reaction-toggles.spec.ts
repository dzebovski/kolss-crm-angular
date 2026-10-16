import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { LeadReaction } from '@domain/lead.types';
import { LeadsService } from '@services/leads.service';
import { LeadReactionToggles } from './lead-reaction-toggles';

@Component({
  imports: [LeadReactionToggles],
  template: `
    <div
      class="row"
      role="link"
      tabindex="0"
      (click)="rowClicks = rowClicks + 1"
      (keydown.enter)="rowClicks = rowClicks + 1"
    >
      <app-lead-reaction-toggles leadId="lead-1" [(reactions)]="reactions" />
    </div>
  `,
})
class Host {
  readonly reactions = signal<readonly LeadReaction[]>([
    { kind: 'star', count: 1, userIds: ['u-2'], userNames: ['Олена'] },
  ]);
  rowClicks = 0;
}

describe('LeadReactionToggles', () => {
  const setReaction = vi.fn();

  beforeEach(async () => {
    setReaction.mockReset();
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        {
          provide: LeadsService,
          useValue: {
            setReaction,
            currentUserId: () => 'u-1',
            currentUserName: () => 'Я',
          },
        },
      ],
    }).compileComponents();
  });

  const buttons = (element: HTMLElement) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('.lead-reaction'));

  it('adds my star with the server state and does not open the row', async () => {
    setReaction.mockResolvedValue({
      kind: 'star',
      count: 2,
      userIds: ['u-2', 'u-1'],
      userNames: ['Олена', 'Я'],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    buttons(fixture.nativeElement)[1]!.click();
    await fixture.whenStable();

    expect(setReaction).toHaveBeenCalledWith('lead-1', 'star', true);
    expect(fixture.componentInstance.reactions()[0]?.count).toBe(2);
    expect(fixture.componentInstance.rowClicks).toBe(0);
    expect(buttons(fixture.nativeElement)[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('rolls back when saving fails', async () => {
    setReaction.mockRejectedValue(new Error('boom'));
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    buttons(fixture.nativeElement)[0]!.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.reactions().map((reaction) => reaction.kind)).toEqual([
      'star',
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeTruthy();
  });
});
