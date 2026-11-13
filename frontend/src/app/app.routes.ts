import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'RouteWise',
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: 'trips',
    canActivate: [authGuard],
    title: 'Trips · RouteWise',
    loadComponent: () => import('./features/trips/trip-list-page').then((m) => m.TripListPage),
  },
  {
    path: 'trips/new',
    canActivate: [authGuard],
    title: 'New trip · RouteWise',
    loadComponent: () => import('./features/trips/trip-form-page').then((m) => m.TripFormPage),
  },
  {
    path: 'trips/:id',
    canActivate: [authGuard],
    title: 'Trip · RouteWise',
    loadComponent: () =>
      import('./features/trips/trip-details-page').then((m) => m.TripDetailsPage),
  },
  {
    path: 'trips/:id/edit',
    canActivate: [authGuard],
    title: 'Edit trip · RouteWise',
    loadComponent: () => import('./features/trips/trip-form-page').then((m) => m.TripFormPage),
  },
  {
    path: 'modes',
    title: 'Modes · RouteWise',
    loadComponent: () => import('./features/modes/modes-page').then((m) => m.ModesPage),
  },
  {
    path: 'login',
    title: 'Log in · RouteWise',
    data: { mode: 'login' },
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    title: 'Create account · RouteWise',
    data: { mode: 'register' },
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: '**',
    title: 'Page not found · RouteWise',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
