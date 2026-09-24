import { Routes } from '@angular/router';

import { superAdminGuard } from '@core/auth/role.guard';

const V2_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/v2-shell').then((page) => page.V2Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'leads' },
      {
        path: 'leads',
        loadComponent: () => import('./leads/list/v2-leads-page').then((page) => page.V2LeadsPage),
      },
      {
        path: 'leads/:leadId',
        loadComponent: () =>
          import('./leads/card/v2-lead-card-page').then((page) => page.V2LeadCardPage),
      },
      {
        // Tasks will be redesigned; until then the section shows an in-development block.
        path: 'tasks',
        loadComponent: () =>
          import('./shell/v2-placeholder-page').then((page) => page.V2PlaceholderPage),
        data: { sectionKey: 'v2.nav.section.planning', titleKey: 'v2.nav.tasks' },
      },
      {
        // The v2 design system page; its content is not defined yet.
        path: 'design',
        canActivate: [superAdminGuard],
        loadComponent: () =>
          import('./shell/v2-placeholder-page').then((page) => page.V2PlaceholderPage),
        data: { sectionKey: 'v2.nav.section.settings', titleKey: 'v2.nav.designSystem' },
      },
      { path: '**', redirectTo: 'leads' },
    ],
  },
];

export default V2_ROUTES;
