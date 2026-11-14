import { parseV2ProjectsQuery, toV2ProjectsQueryParams } from './v2-projects-query';

describe('v2 projects list query', () => {
  it('parses known statuses in chip order and drops unknown ones', () => {
    const query = parseV2ProjectsQuery({
      view: 'kanban',
      q: 'kow',
      manager: 'm-1',
      status: 'installation,bogus,production,measurement_design',
    });
    expect(query).toEqual({
      view: 'kanban',
      q: 'kow',
      manager: 'm-1',
      statuses: ['measurement_design', 'installation'],
    });
  });

  it('falls back to the list and empty filters', () => {
    expect(parseV2ProjectsQuery({ view: 'grid' })).toEqual({
      view: 'list',
      q: '',
      manager: '',
      statuses: [],
    });
  });

  it('drops defaults from the query params', () => {
    expect(toV2ProjectsQueryParams({ view: 'list', q: '  ', manager: '', statuses: [] })).toEqual({
      view: null,
      q: null,
      manager: null,
      status: null,
    });
    expect(
      toV2ProjectsQueryParams({
        view: 'kanban',
        q: ' W02 ',
        manager: 'm-1',
        statuses: ['factory_approval', 'cancelled'],
      }),
    ).toEqual({ view: 'kanban', q: 'W02', manager: 'm-1', status: 'factory_approval,cancelled' });
  });
});
