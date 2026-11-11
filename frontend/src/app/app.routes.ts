import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'RouteWise',
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'trips',
    title: 'Trips · RouteWise',
    loadComponent: () => import('./features/trips/trip-list-page').then((m) => m.TripListPage),
  },
  {
    path: 'trips/new',
    title: 'New trip · RouteWise',
    loadComponent: () => import('./features/trips/trip-form-page').then((m) => m.TripFormPage),
  },
  {
    path: 'trips/:id',
    title: 'Trip · RouteWise',
    loadComponent: () =>
      import('./features/trips/trip-details-page').then((m) => m.TripDetailsPage),
  },
  {
    path: 'trips/:id/edit',
    title: 'Edit trip · RouteWise',
    loadComponent: () => import('./features/trips/trip-form-page').then((m) => m.TripFormPage),
  },
  {
    path: '**',
    title: 'Page not found · RouteWise',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
