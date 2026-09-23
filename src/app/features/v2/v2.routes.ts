import { Routes } from '@angular/router';

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
      { path: '**', redirectTo: 'leads' },
    ],
  },
];

export default V2_ROUTES;
