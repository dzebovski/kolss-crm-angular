import { buildV2Nav, HR_NAV_ITEMS, HR_NAV_SECTIONS } from './v2-nav.config';

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

  it('shows Team time, the HR Admin section and shared settings in HR', () => {
    const groups = buildV2Nav(
      { canManageUsers: true, canImpersonate: true, isImpersonating: false, canManageHr: true },
      HR_NAV_ITEMS,
      HR_NAV_SECTIONS,
    );

    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ['hr-calendar', 'hr-me'],
      ['hr-team', 'hr-reports', 'hr-settings'],
      ['accounts', 'platform-settings', 'language', 'impersonate'],
      ['logout'],
    ]);
  });

  it('hides the HR Admin section without canManageHr', () => {
    const groups = buildV2Nav(
      { canManageUsers: false, canImpersonate: false, isImpersonating: false },
      HR_NAV_ITEMS,
      HR_NAV_SECTIONS,
    );

    expect(groups.map((group) => group.section?.id ?? null)).toEqual([
      'team-time',
      'settings',
      null,
    ]);
  });

  it('offers the way back instead of impersonation while impersonating', () => {
    expect(ids(false, true)).toContainEqual({
      section: 'settings',
      items: ['language', 'stop-impersonation'],
    });
  });
});
