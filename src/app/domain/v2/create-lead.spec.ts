import { v2CreateLeadLegacySource, v2CreateLeadLocalDateTime } from './create-lead';

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

  it('keeps the v2 channel while mapping the compatible legacy source', () => {
    expect(v2CreateLeadLegacySource('office')).toBe('office');
    expect(v2CreateLeadLegacySource('website')).toBe('website');
    expect(v2CreateLeadLegacySource('meta_ads')).toBe('facebook');
    expect(v2CreateLeadLegacySource('phone')).toBe('other');
    expect(v2CreateLeadLegacySource('google_ads')).toBe('other');
    expect(v2CreateLeadLegacySource('referral')).toBe('other');
  });
});
