import { TestBed } from '@angular/core/testing';

import type { Lead } from '@domain/lead.types';
import { CalendarOverdueList, type CalendarOverdueRow } from './calendar-overdue-list';

const baseLead: Lead = {
  id: 'lead-1',
  name: 'Overdue Клієнт',
  phone: '+380501110001',
  email: null,
  leadStatus: 'in_progress',
  workflowStatus: 'taken',
  callStatus: 'callback_requested',
  callStatusChangedAt: null,
  clientStatus: 'new_lead',
  clientStatusChangedAt: '2026-07-01T00:00:00.000Z',
  officeCode: 'kyiv',
  source: 'website',
  sourceCreatedAt: '2026-06-01T00:00:00.000Z',
  initialMessage: '',
  cityRegion: '',
  productInterest: '',
  estimatedBudget: null,
  assignedToId: 'manager-1',
  firstManagerId: null,
  firstCall: null,
  visit: null,
  close: null,
  contract: null,
  callbackDueAt: '2026-07-10T09:00:00.000Z',
  commentReminderDueAt: null,
  commentReminderAssignedTo: null,
  lastComment: null,
  latestTimelineComment: null,
  lastActivityAt: '2026-07-10T00:00:00.000Z',
  attachments: [],
  events: [],
  markers: [],
};

const callbackRow: CalendarOverdueRow = {
  kind: 'callback',
  lead: baseLead,
  dueAt: '2026-07-10T09:00:00.000Z',
  dateLabel: '10 лип',
  timeLabel: '09:00',
  assigneeName: null,
};

const thinkingRow: CalendarOverdueRow = {
  kind: 'thinking',
  lead: { ...baseLead, id: 'lead-2', name: 'Думає Клієнт' },
  dueAt: '2026-07-11T10:00:00.000Z',
  dateLabel: '11 лип',
  timeLabel: '10:00',
  assigneeName: null,
};

const taskRow: CalendarOverdueRow = {
  kind: 'comment',
  lead: { ...baseLead, id: 'lead-3', name: 'Задача Клієнт' },
  dueAt: '2026-07-12T11:00:00.000Z',
  dateLabel: '12 лип',
  timeLabel: '11:00',
  assigneeName: 'Олена',
};

// Same lead, two different overdue reminder kinds — each must render as its
// own row (no lead-level grouping/dedup).
const sameLeadCallbackRow: CalendarOverdueRow = {
  ...callbackRow,
  kind: 'callback',
};
const sameLeadShowroomRow: CalendarOverdueRow = {
  kind: 'showroom',
  lead: baseLead,
  dueAt: '2026-07-09T08:00:00.000Z',
  dateLabel: '9 лип',
  timeLabel: '08:00',
  assigneeName: null,
};

describe('CalendarOverdueList', () => {
  async function render(rows: readonly CalendarOverdueRow[]) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CalendarOverdueList] }).compileComponents();
    const fixture = TestBed.createComponent(CalendarOverdueList);
    fixture.componentRef.setInput('rows', rows);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows an empty state when there are no overdue reminders', async () => {
    const fixture = await render([]);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.overdue-empty')).not.toBeNull();
    expect(element.querySelectorAll('.overdue-row')).toHaveLength(0);
  });

  it('renders one row per reminder, distinguishing kind by class, icon and label', async () => {
    const fixture = await render([callbackRow, thinkingRow, taskRow]);
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('.overdue-row');

    expect(rows).toHaveLength(3);
    expect(rows[0]?.className).toContain('is-callback');
    expect(rows[0]?.textContent).toContain('Overdue Клієнт');
    expect(rows[0]?.textContent).toContain('10 лип');
    expect(rows[0]?.textContent).toContain('09:00');
    expect(rows[1]?.className).toContain('is-thinking');
    expect(rows[1]?.textContent).toContain('Думає Клієнт');
    expect(rows[2]?.className).toContain('is-comment');
    expect(rows[2]?.textContent).toContain('Задача Клієнт');
    expect(rows[2]?.textContent).toContain('Олена');
  });

  it('renders the same lead twice when it has two distinct overdue reminders', async () => {
    const fixture = await render([sameLeadCallbackRow, sameLeadShowroomRow]);
    const element = fixture.nativeElement as HTMLElement;
    const rows = element.querySelectorAll('.overdue-row');

    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Overdue Клієнт');
    expect(rows[1]?.textContent).toContain('Overdue Клієнт');
    expect(rows[0]?.className).toContain('is-callback');
    expect(rows[1]?.className).toContain('is-showroom');
  });

  it('emits leadSelected when a row is clicked', async () => {
    const fixture = await render([callbackRow]);
    const selected = vi.fn();
    fixture.componentInstance.leadSelected.subscribe(selected);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.overdue-row')!
      .click();

    expect(selected).toHaveBeenCalledWith(baseLead);
  });
});
