import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { Session } from './session';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Requests to the API carry the session cookie, and changing requests echo the
 * `XSRF-TOKEN` cookie in the `X-XSRF-TOKEN` header. Angular's own XSRF support
 * only covers relative URLs; the API runs on another port. A 401 from a page that
 * needs a login ends the session in the UI and opens the login page.
 */
export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = inject(API_BASE_URL);
  if (!request.url.startsWith(apiBaseUrl)) {
    return next(request);
  }
  const token = SAFE_METHODS.includes(request.method)
    ? null
    : readCookie(inject(DOCUMENT), CSRF_COOKIE);
  const withCredentials = request.clone({
    withCredentials: true,
    ...(token && { setHeaders: { [CSRF_HEADER]: token } }),
  });
  const session = inject(Session);
  const router = inject(Router);
  return next(withCredentials).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !request.url.startsWith(`${apiBaseUrl}/api/auth/`)
      ) {
        session.expire();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};

function readCookie(document: Document, name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}
