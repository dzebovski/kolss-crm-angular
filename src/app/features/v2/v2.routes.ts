import { Routes } from '@angular/router';

import { superAdminGuard } from '@core/auth/role.guard';
import { REMEMBER_PARAMS, restoreRememberedFilters } from '@core/navigation/remembered-filters';

const V2_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/v2-shell').then((page) => page.V2Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'leads' },
      {
        path: 'leads',
        data: { [REMEMBER_PARAMS]: ['period', 'createdFrom', 'createdTo', 'status', 'rating'] },
        canActivate: [restoreRememberedFilters],
        loadComponent: () => import('./leads/list/v2-leads-page').then((page) => page.V2LeadsPage),
      },
      {
        path: 'leads/:leadId',
        loadComponent: () =>
          import('./leads/card/v2-lead-card-page').then((page) => page.V2LeadCardPage),
      },
      {
        path: 'projects',
        data: { [REMEMBER_PARAMS]: ['view', 'manager', 'status'] },
        canActivate: [restoreRememberedFilters],
        loadComponent: () =>
          import('./projects/list/v2-projects-page').then((page) => page.V2ProjectsPage),
      },
      {
        path: 'projects/:projectId',
        loadComponent: () =>
          import('./projects/card/v2-project-card-page').then((page) => page.V2ProjectCardPage),
      },
      {
        path: 'projects/:projectId/payments',
        loadComponent: () =>
          import('./projects/payments/v2-project-payments-page').then(
            (page) => page.V2ProjectPaymentsPage,
          ),
      },
      {
        path: 'clients',
        data: { [REMEMBER_PARAMS]: ['filter'] },
        canActivate: [restoreRememberedFilters],
        loadComponent: () =>
          import('./clients/list/v2-clients-page').then((page) => page.V2ClientsPage),
      },
      {
        path: 'clients/:clientId',
        loadComponent: () =>
          import('./clients/card/v2-client-card-page').then((page) => page.V2ClientCardPage),
      },
      {
        path: 'tasks',
        data: { [REMEMBER_PARAMS]: ['view', 'list', 'hide', 'who'] },
        canActivate: [restoreRememberedFilters],
        loadComponent: () => import('./tasks/v2-tasks-page').then((page) => page.V2TasksPage),
      },
      {
        // The v2 design system: tokens and the live UI kit.
        path: 'design',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./design/v2-design-page').then((page) => page.V2DesignPage),
      },
      { path: '**', redirectTo: 'leads' },
    ],
  },
];

export default V2_ROUTES;
