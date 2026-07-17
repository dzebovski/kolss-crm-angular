import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/auth.guard';
import { superAdminGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/root-redirect/root-redirect').then((page) => page.RootRedirect),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login-page').then((page) => page.LoginPage),
  },
  {
    path: 'design/radial-menu',
    title: 'Radial Menu | KOLSS',
    loadComponent: () =>
      import('./pages/design/radial-menu/radial-menu-page').then((page) => page.RadialMenuPage),
  },
  {
    path: 'design',
    title: 'Design system | KOLSS',
    loadComponent: () => import('./pages/design/design-page').then((page) => page.DesignPage),
  },
  {
    path: 'crm',
    canActivate: [authGuard],
    loadComponent: () => import('./features/crm/shell/crm-shell').then((page) => page.CrmShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'leads' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/crm/dashboard/dashboard-page').then((page) => page.DashboardPage),
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./features/crm/leads/leads-page').then((page) => page.LeadsPage),
      },
      {
        path: 'leads/:leadId',
        loadComponent: () =>
          import('./features/crm/leads/lead-detail-page').then((page) => page.LeadDetailPage),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/crm/reports/reports-page').then((page) => page.ReportsPage),
      },
      {
        path: 'accounts',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/crm/accounts/accounts-page').then((page) => page.AccountsPage),
      },
      {
        path: 'accounts/:employeeId',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/crm/accounts/employee-detail-page').then(
            (page) => page.EmployeeDetailPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
