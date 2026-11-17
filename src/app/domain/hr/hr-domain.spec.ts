import type { HrCell, HrHoliday, HrOffice, HrPattern } from '@core/api/generated/kolss-api.types';
import { hrCoveredMinutes, hrDayCoverage, hrOfficeInterval } from './hr-calendar';
import { addDays, isoWeekday, mondayOf, monthEnd, monthWeeks, shiftMonth } from './hr-dates';
import { hrAbsenceDays, hrDateError, validateHrAbsence } from './hr-entry';
import { hrPlanCounter, hrPlanDayState, hrPlanRequest, type HrPlanDay } from './hr-plan';

const OFFICE: HrOffice = {
  id: 'o1',
  code: 'warsaw',
  nameUk: 'Легіоново',
  namePl: 'Legionowo',
  timeZone: 'Europe/Warsaw',
  defaultVacationDays: 20,
  hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    opens: weekday === 7 ? null : '10:00',
    closes: weekday === 7 ? null : weekday === 6 ? '15:00' : '19:00',
  })),
};

function pattern(over: Partial<HrPattern>): HrPattern {
  return {
    id: 'p',
    validFrom: '2026-01-01',
    validTo: null,
    kind: 'fixed',
    weekdays: [1, 2, 3, 4, 5],
    startTime: '10:00',
    endTime: '18:00',
    daysPerWeek: 5,
    hoursPerDay: 8,
    note: null,
    createdAt: '',
    createdBy: null,
    createdByName: null,
    ...over,
  };
}

function cell(over: Partial<HrCell>): HrCell {
  return {
    employeeId: 'e1',
    date: '2026-11-18',
    isWorkday: true,
    isPatternDay: true,
    plannedStart: '10:00',
    plannedEnd: '14:00',
    plannedMinutes: 240,
    shiftKind: 'planned',
    isMakeup: false,
    officeDays: 1,
    absence: null,
    ...over,
  };
}

describe('hr dates', () => {
  it('works with ISO weekdays and Monday-first weeks', () => {
    expect(isoWeekday('2026-11-22')).toBe(7);
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('shifts months across years and pads the month grid', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
    const weeks = monthWeeks('2026-11');
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]).toBe('2026-11-01');
  });
});

describe('hr edit windows', () => {
  it('lets an employee add an absence from today but not yesterday', () => {
    expect(hrDateError('2026-11-17', '2026-11-17', '2026-11-17')).toBeNull();
    expect(hrDateError('2026-11-16', '2026-11-17', '2026-11-17')).toBe('hr_past_date');
  });

  it('reports a closed month and never limits the super admin', () => {
    expect(hrDateError('2026-10-30', '2026-11-17', '2026-11-17')).toBe('hr_closed_month');
    expect(hrDateError('2026-10-30', '2026-11-17', null)).toBeNull();
  });

  it('validates order of dates and the comment for Other', () => {
    const errors = validateHrAbsence(
      {
        type: 'other',
        dateFrom: '2026-11-20',
        dateTo: '2026-11-19',
        part: 'full_day',
        comment: ' ',
      },
      '2026-11-17',
      '2026-11-17',
    );
    expect(errors).toEqual({
      dateFrom: null,
      dateTo: 'hr_end_before_start',
      comment: 'hr_comment_required',
    });
  });
});

describe('hrAbsenceDays', () => {
  const holidays: HrHoliday[] = [
    { id: 'h', officeId: 'o1', day: '2026-11-11', kind: 'public_holiday', name: 'x' },
  ];

  it('counts fixed pattern weekdays without holidays', () => {
    const range = { dateFrom: '2026-11-09', dateTo: '2026-11-15', part: 'full_day' as const };
    expect(hrAbsenceDays(range, pattern({}), OFFICE, holidays)).toBe(4);
  });

  it('caps a flexible pattern at days per week', () => {
    const range = { dateFrom: '2026-11-16', dateTo: '2026-11-22', part: 'full_day' as const };
    expect(hrAbsenceDays(range, pattern({ kind: 'flexible', daysPerWeek: 3 }), OFFICE, [])).toBe(3);
  });

  it('counts a single half day as 0.5', () => {
    const range = { dateFrom: '2026-11-18', dateTo: '2026-11-18', part: 'first_half' as const };
    expect(hrAbsenceDays(range, pattern({}), OFFICE, [])).toBe(0.5);
  });
});

describe('week coverage', () => {
  it('merges overlapping intervals inside office hours', () => {
    const intervals = [
      { start: 540, end: 720 },
      { start: 660, end: 840 },
      { start: 1000, end: 1200 },
    ];
    expect(hrCoveredMinutes(intervals, 600, 1140)).toBe(240 + 140);
  });

  it('does not count remote or full-day absence, halves a half day', () => {
    const base = { type: 'vacation' as const, dateFrom: '', dateTo: '' };
    expect(
      hrOfficeInterval(cell({ absence: { ...base, type: 'remote', part: 'full_day' } })),
    ).toBeNull();
    expect(hrOfficeInterval(cell({ absence: { ...base, part: 'first_half' } }))).toEqual({
      start: 720,
      end: 840,
    });
    const coverage = hrDayCoverage({ office: OFFICE, cells: [cell({})] }, '2026-11-18');
    expect(coverage).toEqual({ covered: 240, open: 540 });
  });
});

describe('plan my hours', () => {
  const day = (over: Partial<HrPlanDay>): HrPlanDay => ({
    date: '2026-11-23',
    start: '10:00',
    end: '14:00',
    makeup: false,
    ...over,
  });

  it('locks today and past days, refuses times outside office hours', () => {
    const none = new Set<string>();
    expect(hrPlanDayState(day({ date: '2026-11-17' }), OFFICE, undefined, '2026-11-18', none)).toBe(
      'locked',
    );
    expect(hrPlanDayState(day({ end: '19:30' }), OFFICE, undefined, '2026-11-18', none)).toBe(
      'outside',
    );
    expect(hrPlanDayState(day({ end: '09:00' }), OFFICE, undefined, '2026-11-18', none)).toBe(
      'end_before_start',
    );
    expect(hrPlanDayState(day({}), OFFICE, undefined, '2026-11-18', none)).toBe('ok');
  });

  it('counts hours against the weekly norm and sends only editable days', () => {
    const week = [
      day({}),
      day({ date: '2026-11-24', makeup: true }),
      day({ date: '2026-11-25', start: '', end: '' }),
    ];
    const counter = hrPlanCounter(
      week,
      pattern({ kind: 'flexible', daysPerWeek: 2, hoursPerDay: 4 }),
    );
    expect(counter).toMatchObject({ minutes: 480, days: 2, normMinutes: 480, ok: true });
    expect(hrPlanRequest(week, '2026-11-24')).toEqual([
      { date: '2026-11-24', startTime: '10:00', endTime: '14:00', kind: 'makeup' },
    ]);
  });
});
