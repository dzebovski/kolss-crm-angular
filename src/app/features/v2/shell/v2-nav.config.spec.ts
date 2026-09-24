import { buildV2Nav } from './v2-nav.config';

const ids = (isSuperAdmin: boolean) =>
  buildV2Nav({ isSuperAdmin }).map((group) => ({
    section: group.section?.id ?? null,
    items: group.items.map((item) => item.id),
  }));

describe('buildV2Nav', () => {
  it('shows every item in design order to a super admin', () => {
    expect(ids(true)).toEqual([
      { section: 'sales', items: ['leads', 'projects', 'clients'] },
      { section: 'planning', items: ['meetings-calendar', 'tasks'] },
      { section: 'reports', items: ['lead-reports', 'financial-funnel-reports'] },
      {
        section: 'settings',
        items: ['accounts', 'platform-settings', 'language', 'impersonate', 'design-system'],
      },
      { section: null, items: ['logout'] },
    ]);
  });

  it('hides super admin items from other users', () => {
    expect(ids(false)).toEqual([
      { section: 'sales', items: ['leads', 'projects', 'clients'] },
      { section: 'planning', items: ['meetings-calendar', 'tasks'] },
      { section: 'reports', items: ['lead-reports', 'financial-funnel-reports'] },
      { section: 'settings', items: ['language'] },
      { section: null, items: ['logout'] },
    ]);
  });
});
