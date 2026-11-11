import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'RouteWise',
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: '**',
    title: 'Page not found · RouteWise',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
