import {
  formatV2CardDate,
  formatV2DayRecency,
  formatV2RelativeTime,
  formatV2ReminderDate,
  formatV2ReportDate,
  formatV2Time,
  formatV2TimeRange,
} from './date-format';

// Examples from the design system README, "today" = Wed 23 Sep 2026.
const now = new Date(2026, 8, 23, 14, 0);
const at = (month: number, day: number, hours = 12, minutes = 0, year = 2026) =>
  new Date(year, month - 1, day, hours, minutes);

describe('v2 date format', () => {
  it('formats card and timeline dates', () => {
    expect(formatV2CardDate(at(9, 26), now, 'en')).toBe('Sat 26 Sep');
    expect(formatV2CardDate(at(9, 17), now, 'en')).toBe('Thu 17 Sep');
    expect(formatV2CardDate(at(9, 30), now, 'en')).toBe('30 Sep');
    expect(formatV2CardDate(at(9, 12), now, 'en')).toBe('12 Sep');
    expect(formatV2CardDate(at(8, 15), now, 'en')).toBe('15/08');
    expect(formatV2CardDate(at(8, 15, 12, 0, 2025), now, 'en')).toBe('15/08/2025');
    expect(formatV2CardDate(at(10, 2), at(9, 29), 'en')).toBe('Fri 2 Oct');
  });

  it('formats reminder dates', () => {
    expect(formatV2ReminderDate(at(9, 26), now, 'en')).toBe('Sat 26 Sep');
    expect(formatV2ReminderDate(at(9, 30), now, 'en')).toBe('30 Sep 2026');
    expect(formatV2ReminderDate(at(12, 31), now, 'en')).toBe('31/12/2026');
  });

  it('formats report dates, times and ranges', () => {
    expect(formatV2ReportDate(at(7, 11))).toBe('11/07/2026');
    expect(formatV2Time(at(9, 23, 9, 5))).toBe('09:05');
    expect(formatV2TimeRange(at(9, 26, 12), at(9, 26, 13))).toBe('12:00–13:00');
  });

  it('formats recency', () => {
    expect(formatV2RelativeTime(at(9, 23, 14, 0), now, 'en')).toBe('1 min ago');
    expect(formatV2RelativeTime(at(9, 23, 13, 25), now, 'en')).toBe('35 min ago');
    expect(formatV2RelativeTime(at(9, 23, 13, 0), now, 'en')).toBe('1 hr ago');
    expect(formatV2RelativeTime(at(9, 23, 11, 50), now, 'en')).toBe('2 hrs ago');
    expect(formatV2RelativeTime(at(9, 22, 17, 30), now, 'en')).toBe('1 day ago');
    expect(formatV2RelativeTime(at(9, 18), now, 'en')).toBe('5 days ago');
    expect(formatV2RelativeTime(at(8, 23), now, 'en')).toBe('31 days ago');
    expect(formatV2RelativeTime(at(8, 22), now, 'en')).toBe('1 month ago');
    expect(formatV2RelativeTime(at(7, 19), now, 'en')).toBe('2 months ago');
    expect(formatV2DayRecency(at(8, 15), now, 'en')).toBe('1 month ago');
    expect(formatV2DayRecency(at(9, 23, 8), now, 'en')).toBe('Today');
    expect(formatV2DayRecency(at(9, 22), now, 'en')).toBe('Yesterday');
    expect(formatV2DayRecency(at(9, 20), now, 'en')).toBe('3 days ago');
  });

  it('localizes names and phrases but keeps the numeric pattern', () => {
    expect(formatV2CardDate(at(9, 26), now, 'uk')).toBe('сб 26 вер.');
    expect(formatV2CardDate(at(9, 26), now, 'pl')).toBe('sob. 26 wrz');
    expect(formatV2CardDate(at(8, 15), now, 'uk')).toBe('15/08');
    expect(formatV2RelativeTime(at(9, 18), now, 'uk')).toBe('5 днів тому');
    expect(formatV2DayRecency(at(9, 22), now, 'pl')).toBe('Wczoraj');
  });
});
