import { convertToParamMap } from '@angular/router';

import {
  CALENDAR_REMINDER_FILTER_KIND_MAP,
  parseCalendarPageQuery,
  serializeCalendarPageQuery,
  type CalendarPageQueryState,
} from './calendar-page-query-params';

describe('calendar page query params', () => {
  const parse = (params: Record<string, string>) =>
    parseCalendarPageQuery(convertToParamMap(params));

  it("returns null when the URL carries none of this page's params", () => {
    expect(parse({})).toBeNull();
    expect(parse({ tab: 'calendar' })).toBeNull();
  });

  it('parses a full digest deep link', () => {
    expect(parse({ office: 'kyiv', date: '2026-08-17', kind: 'callback' })).toEqual({
      office: 'kyiv',
      date: '2026-08-17',
      kind: 'callback',
      due: false,
    });
  });

  it('parses the overdue deep link, which carries no date', () => {
    expect(parse({ office: 'warsaw', due: 'overdue' })).toEqual({
      office: 'warsaw',
      date: null,
      kind: null,
      due: true,
    });
  });

  it('drops unknown office, date and kind values instead of failing', () => {
    expect(parse({ office: 'berlin', date: 'not-a-date', kind: 'nope', due: 'sometimes' })).toEqual(
      {
        office: null,
        date: null,
        kind: null,
        due: false,
      },
    );
  });

  it('only recognises the exact "overdue" due value', () => {
    expect(parse({ due: 'yes' })?.due).toBe(false);
    expect(parse({ due: 'overdue' })?.due).toBe(true);
  });

  it('round-trips a fully populated state', () => {
    const state: CalendarPageQueryState = {
      office: 'warsaw',
      date: '2026-08-17',
      kind: 'reminder',
      due: false,
    };
    expect(parse(serializeCalendarPageQuery(state))).toEqual(state);
  });

  it('round-trips the overdue state, which omits office/date/kind when unset', () => {
    const state: CalendarPageQueryState = { office: null, date: null, kind: null, due: true };
    expect(serializeCalendarPageQuery(state)).toEqual({ due: 'overdue' });
    expect(parse(serializeCalendarPageQuery(state))).toEqual(state);
  });

  it('omits every field from the link when the state is fully unset', () => {
    const state: CalendarPageQueryState = { office: null, date: null, kind: null, due: false };
    expect(serializeCalendarPageQuery(state)).toEqual({});
  });

  it('maps each business filter group onto the canonical LeadReminderKind taxonomy', () => {
    expect(CALENDAR_REMINDER_FILTER_KIND_MAP).toEqual({
      callback: ['callback'],
      visit: [],
      reminder: ['comment', 'thinking'],
    });
  });
});
