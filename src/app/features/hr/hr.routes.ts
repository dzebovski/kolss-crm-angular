import { Routes } from '@angular/router';

import { hrAdminGuard } from '@core/auth/role.guard';

// HR portal (/hr, KOLSS HR canvas): the v2 shell in the HR workspace. Calendar and My time are
// for every signed-in user; Team, Reports and HR settings need `/v1/me` `canManageHr`.
const HR_ROUTES: Routes = [
  {
    path: '',
    data: { workspace: 'HR' },
    loadComponent: () => import('../v2/shell/v2-shell').then((page) => page.V2Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendar' },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./calendar/hr-calendar-page').then((page) => page.HrCalendarPage),
      },
      {
        path: 'me',
        loadComponent: () => import('./me/hr-me-page').then((page) => page.HrMePage),
      },
      {
        path: 'employees',
        canActivate: [hrAdminGuard],
        loadComponent: () => import('./team/hr-team-page').then((page) => page.HrTeamPage),
      },
      {
        path: 'employees/:employeeId',
        canActivate: [hrAdminGuard],
        loadComponent: () =>
          import('./employee/hr-employee-page').then((page) => page.HrEmployeePage),
      },
      {
        path: 'reports',
        canActivate: [hrAdminGuard],
        loadComponent: () => import('./reports/hr-reports-page').then((page) => page.HrReportsPage),
      },
      {
        path: 'settings',
        canActivate: [hrAdminGuard],
        loadComponent: () =>
          import('./settings/hr-settings-page').then((page) => page.HrSettingsPage),
      },
      { path: '**', redirectTo: 'calendar' },
    ],
  },
];

export default HR_ROUTES;
