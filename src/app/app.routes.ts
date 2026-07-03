import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/home/home-page').then((page) => page.HomePage),
  },
  {
    path: 'design',
    loadComponent: () => import('./pages/design/design-page').then((page) => page.DesignPage),
  },
  { path: '**', redirectTo: '' },
];
