import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api/api-config';
import { apiErrorInterceptor } from '../api/api-error';
import { ALICE } from './auth.testing';
import { Session } from './session';

const API = 'http://api.test/api/auth';

describe('Session', () => {
  let session: Session;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    session = TestBed.inject(Session);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('starts logged out', () => {
    expect(session.user()).toBeNull();
    expect(session.loggedIn()).toBe(false);
  });

  it('loads the logged-in user', async () => {
    const loaded = session.load();
    httpTesting.expectOne(`${API}/me`).flush(ALICE);
    await loaded;

    expect(session.user()).toEqual(ALICE);
    expect(session.loggedIn()).toBe(true);
  });

  it('treats 401 and an unreachable API as logged out', async () => {
    const unauthorized = session.load();
    httpTesting.expectOne(`${API}/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await unauthorized;
    expect(session.loggedIn()).toBe(false);

    const unreachable = session.load();
    httpTesting.expectOne(`${API}/me`).error(new ProgressEvent('error'));
    await unreachable;
    expect(session.loggedIn()).toBe(false);
  });

  it('is logged in after login and after registration', () => {
    session.login({ email: ALICE.email, password: 'correct horse' }).subscribe();
    httpTesting.expectOne(`${API}/login`).flush(ALICE);
    expect(session.user()).toEqual(ALICE);

    session.expire();
    expect(session.loggedIn()).toBe(false);

    session
      .register({ email: ALICE.email, password: 'correct horse', displayName: 'Alice' })
      .subscribe();
    httpTesting.expectOne(`${API}/register`).flush(ALICE);
    expect(session.user()).toEqual(ALICE);
  });

  it('stays logged out after a failed login', () => {
    session.login({ email: ALICE.email, password: 'wrong' }).subscribe({ error: () => undefined });
    httpTesting.expectOne(`${API}/login`).flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(session.loggedIn()).toBe(false);
  });

  it('logs out in the UI even if the API call fails', () => {
    session.login({ email: ALICE.email, password: 'correct horse' }).subscribe();
    httpTesting.expectOne(`${API}/login`).flush(ALICE);

    session.logout().subscribe();
    httpTesting.expectOne(`${API}/logout`).error(new ProgressEvent('error'));

    expect(session.loggedIn()).toBe(false);
  });
});
