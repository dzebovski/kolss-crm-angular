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
      createdFrom: null,
      createdTo: null,
      statuses: ['later', 'lost'],
      ratings: ['hot'],
    });
    expect(parseV2LeadsQuery({ period: 'custom' }).period).toBe('d40');
    expect(
      parseV2LeadsQuery({
        period: 'custom',
        createdFrom: '2026-08-10',
        createdTo: '2026-09-23',
      }),
    ).toMatchObject({
      period: 'custom',
      createdFrom: '2026-08-10',
      createdTo: '2026-09-23',
    });
  });

  it('omits defaults from the URL', () => {
    expect(
      toV2LeadsQueryParams({
        q: '  ',
        period: 'd40',
        createdFrom: null,
        createdTo: null,
        statuses: [],
        ratings: [],
      }),
    ).toEqual({
      q: null,
      period: null,
      createdFrom: null,
      createdTo: null,
      status: null,
      rating: null,
    });

    expect(
      toV2LeadsQueryParams({
        q: '',
        period: 'custom',
        createdFrom: '2026-08-10',
        createdTo: '2026-09-23',
        statuses: [],
        ratings: [],
      }),
    ).toMatchObject({
      period: 'custom',
      createdFrom: '2026-08-10',
      createdTo: '2026-09-23',
    });
  });
});
