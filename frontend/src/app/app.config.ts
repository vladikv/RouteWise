import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { apiErrorInterceptor } from './core/api/api-error';
import { credentialsInterceptor } from './core/auth/credentials-interceptor';
import { Session } from './core/auth/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // The credentials interceptor sits inside the error interceptor, so it still sees the raw 401.
    provideHttpClient(withInterceptors([apiErrorInterceptor, credentialsInterceptor])),
    // Know who is logged in before the first route is guarded.
    provideAppInitializer(() => inject(Session).load()),
  ],
};
