import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { LoginRequest, RegisterRequest, User } from './models';

/** Accounts and the login session (an HTTP-only session cookie set by the API). */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/auth`;

  /** The logged-in account; fails with 401 when nobody is logged in. */
  me(): Observable<User> {
    return this.http.get<User>(`${this.url}/me`);
  }

  login(request: LoginRequest): Observable<User> {
    return this.http.post<User>(`${this.url}/login`, request);
  }

  /** Creates the account and logs it in. */
  register(request: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.url}/register`, request);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.url}/logout`, null);
  }
}
