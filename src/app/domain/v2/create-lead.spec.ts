import { v2CreateLeadLocalDateTime } from './create-lead';

describe('v2 create lead rules', () => {
  it('formats the creation time in the selected showroom time zone', () => {
    const instant = new Date('2026-01-01T00:30:00.000Z');

    expect(v2CreateLeadLocalDateTime(instant, 'warsaw')).toEqual({
      date: '2026-01-01',
      time: '01:30',
    });
    expect(v2CreateLeadLocalDateTime(instant, 'kyiv')).toEqual({
      date: '2026-01-01',
      time: '02:30',
    });
  });
});
