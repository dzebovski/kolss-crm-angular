import { parseV2ClientsQuery, toV2ClientsQueryParams } from './v2-clients-query';

describe('clients list query', () => {
  it('falls back to All clients for an unknown filter', () => {
    expect(parseV2ClientsQuery({ q: 'marta', filter: 'bogus' })).toEqual({
      q: 'marta',
      filter: 'all',
    });
    expect(parseV2ClientsQuery({ filter: 'leads_only' }).filter).toBe('leads_only');
  });

  it('drops the defaults from the URL', () => {
    expect(toV2ClientsQueryParams({ q: ' ', filter: 'all' })).toEqual({ q: null, filter: null });
    expect(toV2ClientsQueryParams({ q: 'w02', filter: 'with_projects' })).toEqual({
      q: 'w02',
      filter: 'with_projects',
    });
  });
});
