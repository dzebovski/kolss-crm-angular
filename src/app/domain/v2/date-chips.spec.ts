import { v2IsPastDateTime, v2QuickDateChips } from './date-chips';

// Same instant as the boards' own `NOW` (Create-lead.dc.html): Friday 25 Sep 2026, 14:32.
const NOW = new Date(2026, 8, 25, 14, 32);

describe('v2QuickDateChips', () => {
  it('matches the boards’ four targets for the same "now" (Create-lead.dc.html QUICK)', () => {
    const chips = v2QuickDateChips(NOW);
    expect(chips.map((c) => c.key)).toEqual(['in2h', 'tomorrow', 'nextMonday', 'inWeek']);
    expect(chips[0].at).toEqual(new Date(2026, 8, 25, 16, 32));
    expect(chips[1].at).toEqual(new Date(2026, 8, 26, 10, 0));
    expect(chips[2].at).toEqual(new Date(2026, 8, 28, 10, 0));
    expect(chips[3].at).toEqual(new Date(2026, 9, 2, 10, 0));
  });

  it('skips today when "now" is already a Monday', () => {
    const monday = new Date(2026, 8, 28, 9, 0);
    const nextMonday = v2QuickDateChips(monday).find((c) => c.key === 'nextMonday');
    expect(nextMonday?.at).toEqual(new Date(2026, 9, 5, 10, 0));
  });
});

describe('v2IsPastDateTime', () => {
  it('flags a time before now', () => {
    expect(v2IsPastDateTime(new Date(2026, 8, 25, 10, 0), NOW)).toBe(true);
  });

  it('accepts a time at or after now', () => {
    expect(v2IsPastDateTime(new Date(2026, 8, 25, 14, 32), NOW)).toBe(false);
    expect(v2IsPastDateTime(new Date(2026, 8, 25, 15, 0), NOW)).toBe(false);
  });
});
