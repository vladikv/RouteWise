import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';

/** Pages that need a login send logged-out visitors to `/login`, and back afterwards. */
export const authGuard: CanActivateFn = (_route, state) =>
  inject(Session).loggedIn() ||
  inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

/**
 * Where to go after login: only paths inside the app, so a crafted link
 * cannot send the user to another site.
 */
export function safeReturnUrl(url: string | undefined): string {
  // "//host" and "/\host" are treated by browsers as links to another host.
  const internal = /^\/(?![/\\])/.test(url ?? '');
  return internal && url ? url : '/trips';
}
