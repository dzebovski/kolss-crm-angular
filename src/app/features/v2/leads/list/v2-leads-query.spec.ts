import { parseV2LeadsQuery, toV2LeadsQueryParams } from './v2-leads-query';

describe('v2 leads query params', () => {
  it('parses known values, drops unknown ones and falls back to 40 days', () => {
    expect(
      parseV2LeadsQuery({
        q: 'anna',
        period: 'week',
        status: 'lost,foo,later',
        rating: 'hot,warm',
      }),
    ).toEqual({
      q: 'anna',
      period: 'week',
      statuses: ['later', 'lost'],
      ratings: ['hot'],
    });
    expect(parseV2LeadsQuery({ period: 'custom' }).period).toBe('d40');
  });

  it('omits defaults from the URL', () => {
    expect(toV2LeadsQueryParams({ q: '  ', period: 'd40', statuses: [], ratings: [] })).toEqual({
      q: null,
      period: null,
      status: null,
      rating: null,
    });
  });
});
