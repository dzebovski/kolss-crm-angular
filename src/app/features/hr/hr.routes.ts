import { Routes } from '@angular/router';

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
      { path: '**', redirectTo: 'calendar' },
    ],
  },
];

export default HR_ROUTES;
