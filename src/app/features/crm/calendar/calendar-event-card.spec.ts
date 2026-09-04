import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';

import { I18nService } from '@core/i18n/i18n.service';
import { SessionService } from '@core/session/session.service';
import { UiIcon } from '@ui/icon/ui-icon';
import {
  CalendarEventCard,
  type CalendarEventCardDensity,
  type CalendarEventCardModel,
  type CalendarEventKind,
} from './calendar-event-card';

const baseEvent: CalendarEventCardModel = {
  kind: 'showroom',
  time: '12:30',
  lead: {
    id: 'lead-1',
    referenceId: 'k0101',
    name: 'Анна Коваль',
    phone: '+380501112233',
  },
  managerName: 'Олена',
  comment: 'Підготувати зразки тканини',
  status: 'scheduled',
  hasWarning: false,
};

describe('CalendarEventCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarEventCard],
      providers: [{ provide: SessionService, useValue: { locale: () => 'uk' } }],
    }).compileComponents();
    await TestBed.inject(I18nService).ensureLoaded('uk');
  });

  function render(
    event: CalendarEventCardModel = baseEvent,
    density: CalendarEventCardDensity = 'full',
  ) {
    const fixture = TestBed.createComponent(CalendarEventCard);
    fixture.componentRef.setInput('event', event);
    fixture.componentRef.setInput('density', density);
    fixture.detectChanges();
    return fixture;
  }

  function iconNames(fixture: ReturnType<typeof render>): string[] {
    return fixture.debugElement
      .queryAll(By.directive(UiIcon))
      .map((icon) => icon.componentInstance.name());
  }

  it.each([
    ['showroom', 'storefront'],
    ['measurement', 'straighten'],
    ['office_work', 'business_center'],
    ['callback', 'phone_in_talk'],
    ['thinking', 'handshake'],
    ['postponed', 'snooze'],
    ['comment', 'chat_bubble'],
    ['task', 'assignment_ind'],
  ] as const)('uses the agreed icon for %s events', (kind, icon) => {
    const fixture = render({ ...baseEvent, kind: kind as CalendarEventKind, status: null });

    expect(iconNames(fixture)).toContain(icon);
    if (kind === 'task') {
      expect(fixture.nativeElement.querySelector('.status-base')).toBeNull();
    } else {
      expect(fixture.nativeElement.querySelector('.status-base')).not.toBeNull();
    }
  });

  it('places the task icon before its title without duplicating it on the right', () => {
    const fixture = render({ ...baseEvent, kind: 'task', status: null });
    const headingIcon = fixture.debugElement.query(By.css('.event-heading app-ui-icon'));

    expect(headingIcon.componentInstance.name()).toBe('assignment_ind');
    expect(fixture.nativeElement.querySelector('.event-top > .event-state')).toBeNull();
    expect(iconNames(fixture).filter((name) => name === 'assignment_ind')).toHaveLength(1);
  });

  it('keeps a semantic task state on the right', () => {
    const fixture = render({ ...baseEvent, kind: 'task', status: null, hasWarning: true });

    expect(iconNames(fixture)).toContain('assignment_ind');
    expect(iconNames(fixture)).toContain('warning');
    expect(fixture.nativeElement.querySelector('.event-top > .status-warning')).not.toBeNull();
  });

  it('does not duplicate the task icon in the month variant', () => {
    const fixture = render({ ...baseEvent, kind: 'task', status: null }, 'month');

    expect(iconNames(fixture).filter((name) => name === 'assignment_ind')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.month-main > .event-state')).toBeNull();
  });

  it('gives a terminal status priority over a warning', () => {
    const fixture = render({ ...baseEvent, status: 'canceled', hasWarning: true });
    const state = fixture.nativeElement.querySelector('.event-state') as HTMLElement;

    expect(iconNames(fixture)).toContain('cancel');
    expect(iconNames(fixture)).not.toContain('warning');
    expect(state.textContent).toContain('Скасовано');
    expect(state.classList).toContain('status-canceled');
  });

  it('shows a warning before the base event icon', () => {
    const fixture = render({ ...baseEvent, hasWarning: true });

    expect(iconNames(fixture)).toContain('warning');
    expect(fixture.nativeElement.querySelector('.status-warning')?.textContent).toContain(
      'Є попередження',
    );
  });

  it('uses measurement-specific completed and no-show labels', () => {
    const completed = render({ ...baseEvent, kind: 'measurement', status: 'visited' });
    expect(completed.nativeElement.querySelector('.event-state')?.textContent).toContain(
      'Замір виконано',
    );

    const missed = render({ ...baseEvent, kind: 'measurement', status: 'no_show' });
    expect(missed.nativeElement.querySelector('.event-state')?.textContent).toContain(
      'Замір не відбувся',
    );
  });

  it('keeps the appointment comment in the full footer and removes the footer at 15 minutes', () => {
    const full = render();
    const comment = full.nativeElement.querySelector('.event-comment') as HTMLElement;
    expect(comment.textContent).toContain('Підготувати зразки тканини');
    expect(comment.title).toBe('Підготувати зразки тканини');

    const compact = render(baseEvent, 'compact');
    expect(compact.nativeElement.querySelector('.event-footer')).toBeNull();
    expect(compact.nativeElement.querySelector('.event-top')).not.toBeNull();
    expect(compact.nativeElement.querySelector('.event-client')).not.toBeNull();
  });

  it('renders the two-row month variant without visible type, comment, or status text', () => {
    const fixture = render({ ...baseEvent, status: 'rescheduled' }, 'month');
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.month-main')).not.toBeNull();
    expect(element.querySelector('.event-footer')?.textContent).toContain('Олена');
    expect(element.querySelector('.event-heading')).toBeNull();
    expect(element.querySelector('.event-comment')).toBeNull();
    expect(element.querySelector('.event-state')?.textContent?.trim()).toBe('');
    expect(element.getAttribute('title')).toContain('Перенесено');
    expect(element.getAttribute('title')).toContain('Підготувати зразки тканини');
  });
});
