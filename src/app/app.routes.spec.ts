import { routes } from './app.routes';

describe('application routes', () => {
  it('exposes canonical CRM destinations at the domain root', () => {
    const shell = routes.find((route) => route.path === '' && !route.pathMatch && route.children);
    const paths = shell?.children?.map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        'dashboard',
        'dashboard/reminders',
        'leads',
        'leads/:leadId',
        'projects',
        'clients',
        'calendar',
        'reports',
        'reports/leads-status',
        'reports/sales-funnel',
        'accounts',
        'accounts/users',
        'accounts/users/:employeeId',
        'accounts/settings',
      ]),
    );
  });

  it('keeps a dedicated matcher for legacy CRM URLs', () => {
    expect(routes.some((route) => route.matcher && route.canActivate?.length)).toBe(true);
  });
});
