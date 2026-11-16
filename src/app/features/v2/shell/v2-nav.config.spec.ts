import { buildV2Nav, HR_NAV_ITEMS } from './v2-nav.config';

const ids = (superAdmin: boolean, isImpersonating = false) =>
  buildV2Nav({ canManageUsers: superAdmin, canImpersonate: superAdmin, isImpersonating }).map(
    (group) => ({
      section: group.section?.id ?? null,
      items: group.items.map((item) => item.id),
    }),
  );

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

  it('shows only shared settings and logout in HR', () => {
    const groups = buildV2Nav(
      { canManageUsers: true, canImpersonate: true, isImpersonating: false },
      HR_NAV_ITEMS,
    );

    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ['accounts', 'platform-settings', 'language', 'impersonate'],
      ['logout'],
    ]);
  });

  it('offers the way back instead of impersonation while impersonating', () => {
    expect(ids(false, true)).toContainEqual({
      section: 'settings',
      items: ['language', 'stop-impersonation'],
    });
  });
});
