import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { apiErrorInterceptor } from '../api/api-error';
import { AuthApi } from '../api/auth-api';
import { ALICE } from './auth.testing';
import { credentialsInterceptor } from './credentials-interceptor';
import { Session } from './session';

const BASE = 'http://api.test';

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    cookie = 'other=1; XSRF-TOKEN=abc%3D123';
    const fakeDocument = {
      get cookie(): string {
        return cookie;
      },
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor, credentialsInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends cookies to the API and the CSRF token on changing requests only', () => {
    http.get(`${BASE}/api/trips`).subscribe();
    http.post(`${BASE}/api/trips`, {}).subscribe();
    http.delete(`${BASE}/api/trips/7`).subscribe();

    const get = httpTesting.expectOne({ method: 'GET', url: `${BASE}/api/trips` }).request;
    expect(get.withCredentials).toBe(true);
    expect(get.headers.has('X-XSRF-TOKEN')).toBe(false);
    const post = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/trips` }).request;
    expect(post.withCredentials).toBe(true);
    expect(post.headers.get('X-XSRF-TOKEN')).toBe('abc=123');
    const remove = httpTesting.expectOne({ method: 'DELETE', url: `${BASE}/api/trips/7` }).request;
    expect(remove.headers.get('X-XSRF-TOKEN')).toBe('abc=123');
  });

  it('sends no header before the API has set the cookie', () => {
    cookie = '';
    http.post(`${BASE}/api/auth/login`, {}).subscribe();

    const post = httpTesting.expectOne(`${BASE}/api/auth/login`).request;
    expect(post.withCredentials).toBe(true);
    expect(post.headers.has('X-XSRF-TOKEN')).toBe(false);
  });

  it('leaves requests to other hosts alone', () => {
    http.post('https://elsewhere.test/x', {}).subscribe();

    const request = httpTesting.expectOne('https://elsewhere.test/x').request;
    expect(request.withCredentials).toBe(false);
    expect(request.headers.has('X-XSRF-TOKEN')).toBe(false);
  });

  it('ends the session and opens the login page on a 401', () => {
    vi.spyOn(TestBed.inject(AuthApi), 'login').mockReturnValue(of(ALICE));
    const session = TestBed.inject(Session);
    session.login({ email: ALICE.email, password: 'x' }).subscribe();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    http.get(`${BASE}/api/trips`).subscribe({ error: () => undefined });
    httpTesting
      .expectOne(`${BASE}/api/trips`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(session.loggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
  });

  it('does not redirect when an auth call answers 401', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    http.post(`${BASE}/api/auth/login`, {}).subscribe({ error: () => undefined });
    httpTesting
      .expectOne(`${BASE}/api/auth/login`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });
});
