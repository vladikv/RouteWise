import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, of, tap } from 'rxjs';
import { AuthApi } from '../api/auth-api';
import { LoginRequest, RegisterRequest, User } from '../api/models';

/**
 * Who is logged in. Loaded once at start-up from `/api/auth/me`; login,
 * registration and logout update it. `null` means logged out.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly authApi = inject(AuthApi);
  private readonly current = signal<User | null>(null);

  readonly user = this.current.asReadonly();
  readonly loggedIn = computed(() => this.current() !== null);

  /** Asks the API for the current session; any failure (401, API down) counts as logged out. */
  load(): Promise<void> {
    return firstValueFrom(
      this.authApi.me().pipe(
        tap((user) => this.current.set(user)),
        catchError(() => {
          this.current.set(null);
          return of(null);
        }),
      ),
    ).then(() => undefined);
  }

  login(request: LoginRequest): Observable<User> {
    return this.authApi.login(request).pipe(tap((user) => this.current.set(user)));
  }

  register(request: RegisterRequest): Observable<User> {
    return this.authApi.register(request).pipe(tap((user) => this.current.set(user)));
  }

  /** Ends the session; the UI is logged out even if the API call fails. */
  logout(): Observable<unknown> {
    return this.authApi.logout().pipe(
      catchError(() => of(null)),
      tap(() => this.current.set(null)),
    );
  }

  /** The API rejected the session (expired or ended elsewhere). */
  expire(): void {
    this.current.set(null);
  }
}
