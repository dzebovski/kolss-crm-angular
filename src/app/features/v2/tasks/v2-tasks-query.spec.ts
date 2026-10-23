import { parseV2TasksQuery, toV2TasksQueryParams, v2VisibleKinds } from './v2-tasks-query';

describe('parseV2TasksQuery', () => {
  it('defaults to My day', () => {
    expect(parseV2TasksQuery({}, false)).toEqual({
      view: 'my_day',
      listId: null,
      q: '',
      hidden: [],
      assigneeId: '',
      taskId: null,
    });
  });

  it('reads a view, chips, search and the open task', () => {
    const query = parseV2TasksQuery(
      { view: 'upcoming', q: 'W0231', hide: 'personal,bogus,visit', task: 'manual:t1' },
      false,
    );
    expect(query).toMatchObject({
      view: 'upcoming',
      q: 'W0231',
      hidden: ['visit', 'personal'],
      taskId: 'manual:t1',
    });
  });

  it('opens All tasks only for those who may see it', () => {
    expect(parseV2TasksQuery({ view: 'all', who: 'u1' }, false).view).toBe('my_day');
    expect(parseV2TasksQuery({ view: 'all', who: 'u1' }, true)).toMatchObject({
      view: 'all',
      assigneeId: 'u1',
    });
  });

  it('ignores the person filter outside All tasks and lets a list win', () => {
    expect(parseV2TasksQuery({ view: 'done', who: 'u1' }, true).assigneeId).toBe('');
    expect(parseV2TasksQuery({ view: 'upcoming', list: 'L1' }, true)).toMatchObject({
      view: 'list',
      listId: 'L1',
    });
  });
});

describe('toV2TasksQueryParams', () => {
  it('drops defaults', () => {
    expect(toV2TasksQueryParams(parseV2TasksQuery({}, false))).toEqual({
      view: null,
      list: null,
      q: null,
      hide: null,
      who: null,
      task: null,
    });
  });

  it('round-trips a list with chips off', () => {
    const query = parseV2TasksQuery({ list: 'L1', hide: 'call', task: 'manual:t1' }, true);
    expect(toV2TasksQueryParams(query)).toMatchObject({
      view: null,
      list: 'L1',
      hide: 'call',
      task: 'manual:t1',
    });
  });
});

describe('v2VisibleKinds', () => {
  const chips = ['call', 'visit', 'comment'] as const;

  it('does not filter while every chip is on', () => {
    expect(v2VisibleKinds([], chips)).toBeNull();
  });

  it('keeps nothing when every chip is off', () => {
    expect(v2VisibleKinds(['call', 'visit', 'comment'], chips)).toEqual([]);
  });

  it('sends the chips that stay on', () => {
    expect(v2VisibleKinds(['visit'], chips)).toEqual(['call', 'comment']);
  });
});
