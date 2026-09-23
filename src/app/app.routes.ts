import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/auth.guard';
import { legacyCrmMatcher, legacyCrmRedirectGuard } from './core/navigation/legacy-crm-redirect';
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
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./pages/design/radial-menu/radial-menu-page').then((page) => page.RadialMenuPage),
  },
  {
    path: 'design',
    title: 'Design system | KOLSS',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./pages/design/design-page').then((page) => page.DesignPage),
  },
  {
    matcher: legacyCrmMatcher,
    canActivate: [legacyCrmRedirectGuard],
    children: [],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/crm/shell/crm-shell').then((page) => page.CrmShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'leads' },
      {
        path: 'dashboard/reminders',
        loadComponent: () =>
          import('./features/crm/dashboard/reminders-page').then((page) => page.RemindersPage),
      },
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
        path: 'projects',
        title: 'Projects | KOLSS',
        loadComponent: () =>
          import('./features/crm/projects/projects-page').then((page) => page.ProjectsPage),
      },
      {
        path: 'clients',
        title: 'Clients | KOLSS',
        loadComponent: () =>
          import('./features/crm/clients/clients-page').then((page) => page.ClientsPage),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/crm/calendar/calendar-page').then((page) => page.CalendarPage),
      },
      {
        path: 'leads/:leadId',
        loadComponent: () =>
          import('./features/crm/leads/lead-detail-route').then((page) => page.LeadDetailPage),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/crm/reports/reports-landing-page').then(
            (page) => page.ReportsLandingPage,
          ),
      },
      {
        path: 'reports/leads-status',
        loadComponent: () =>
          import('./features/crm/reports/reports-page').then((page) => page.ReportsPage),
      },
      {
        path: 'reports/sales-funnel',
        loadComponent: () =>
          import('./features/crm/reports/sales-funnel-page').then((page) => page.SalesFunnelPage),
      },
      {
        path: 'accounts',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/crm/accounts/accounts-hub-page').then((page) => page.AccountsHubPage),
      },
      {
        path: 'accounts/users',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/crm/accounts/accounts-page').then((page) => page.AccountsPage),
      },
      {
        path: 'accounts/users/:employeeId',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/crm/accounts/employee-detail-page').then(
            (page) => page.EmployeeDetailPage,
          ),
      },
      {
        path: 'accounts/settings',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./features/crm/accounts/currency-settings-page').then(
            (page) => page.CurrencySettingsPage,
          ),
      },
      {
        path: 'accounts/:employeeId',
        redirectTo: 'accounts/users/:employeeId',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
