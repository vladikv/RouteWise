import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api-config';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { ALICE } from '../../core/auth/auth.testing';
import { DEMO_ACCOUNT } from '../../core/auth/demo-account';
import { Session } from '../../core/auth/session';
import { errorText, submit, typeInto } from '../trips/trip-form.testing';
import { AuthPage } from './auth-page';

const API = 'http://api.test/api/auth';

describe('AuthPage', () => {
  let fixture: ComponentFixture<AuthPage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(AuthPage);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => httpTesting.verify());

  async function open(mode: 'login' | 'register', returnUrl?: string): Promise<void> {
    fixture.componentRef.setInput('mode', mode);
    if (returnUrl) {
      fixture.componentRef.setInput('returnUrl', returnUrl);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function respond(url: string, body: object, status = 200): Promise<void> {
    httpTesting
      .expectOne({ method: 'POST', url })
      .flush(body, status === 200 ? {} : { status, statusText: 'Error' });
    await fixture.whenStable();
  }

  it('logs in and returns to the page the user wanted', async () => {
    await open('login', '/trips/7');
    expect(page.querySelector('h1')?.textContent).toContain('Log in');
    expect(page.querySelector('#auth-name')).toBeNull();

    typeInto(page, '#auth-email', ' alice@example.com ');
    typeInto(page, '#auth-password', 'correct horse');
    submit(page);
    TestBed.tick();

    const call = httpTesting.expectOne({ method: 'POST', url: `${API}/login` });
    expect(call.request.body).toEqual({ email: 'alice@example.com', password: 'correct horse' });
    call.flush(ALICE);
    await fixture.whenStable();

    expect(TestBed.inject(Session).user()).toEqual(ALICE);
    expect(navigateByUrl).toHaveBeenCalledWith('/trips/7');
  });

  it('ignores a return address outside the app', async () => {
    await open('login', 'https://evil.example');

    typeInto(page, '#auth-email', 'alice@example.com');
    typeInto(page, '#auth-password', 'correct horse');
    submit(page);
    TestBed.tick();
    await respond(`${API}/login`, ALICE);

    expect(navigateByUrl).toHaveBeenCalledWith('/trips');
  });

  it('shows wrong credentials as an alert and stays on the page', async () => {
    await open('login');

    typeInto(page, '#auth-email', 'alice@example.com');
    typeInto(page, '#auth-password', 'wrong password');
    submit(page);
    TestBed.tick();
    await respond(
      `${API}/login`,
      { title: 'Unauthorized', detail: 'Invalid email or password', status: 401 },
      401,
    );

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid email or password',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it('checks the fields before sending', async () => {
    await open('register');

    typeInto(page, '#auth-name', '   ');
    typeInto(page, '#auth-email', 'not-an-email');
    typeInto(page, '#auth-password', 'short');
    submit(page);
    fixture.detectChanges();

    expect(errorText(page, 'auth-name')).toBe('This field is required.');
    expect(errorText(page, 'auth-email')).toBe('Enter a valid email address.');
    expect(errorText(page, 'auth-password')).toBe('Use at least 8 characters.');
    expect(page.querySelector('#auth-password')?.getAttribute('aria-describedby')).toBe(
      'auth-password-hint auth-password-error',
    );
    httpTesting.expectNone(`${API}/register`);
  });

  it('registers and shows a taken email on the email field', async () => {
    await open('register');
    expect(page.querySelector('h1')?.textContent).toContain('Create your account');

    typeInto(page, '#auth-name', ' Alice ');
    typeInto(page, '#auth-email', 'alice@example.com');
    typeInto(page, '#auth-password', 'correct horse');
    submit(page);
    TestBed.tick();

    const call = httpTesting.expectOne({ method: 'POST', url: `${API}/register` });
    expect(call.request.body).toEqual({
      email: 'alice@example.com',
      password: 'correct horse',
      displayName: 'Alice',
    });
    call.flush(
      {
        title: 'Conflict',
        detail: 'email is already registered',
        status: 409,
        errors: [{ field: 'email', message: 'is already registered' }],
      },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();

    expect(errorText(page, 'auth-email')).toBe('Is already registered');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('offers the demo account and logs in with one click', async () => {
    await open('login', '/trips/7');

    const demo = page.querySelector('section[aria-labelledby="demo-title"]');
    expect(demo?.textContent).toContain('demo@routewise.app');
    expect(demo?.textContent).toContain('demo1234');

    demo?.querySelector('button')?.click();
    TestBed.tick();
    const call = httpTesting.expectOne({ method: 'POST', url: `${API}/login` });
    expect(call.request.body).toEqual({ email: 'demo@routewise.app', password: 'demo1234' });
    call.flush({ id: 1, email: 'demo@routewise.app', displayName: 'Demo traveller' });
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/trips/7');
  });

  it('keeps the return address when switching between login and registration', async () => {
    await open('login', '/trips/new');

    const link = page.querySelector<HTMLAnchorElement>('a[href^="/register"]');
    expect(link?.getAttribute('href')).toBe('/register?returnUrl=%2Ftrips%2Fnew');
  });
});

describe('AuthPage without a demo account', () => {
  it('hides the demo offer', async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DEMO_ACCOUNT, useValue: null },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AuthPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('#demo-title')).toBeNull();
    expect(page.querySelector('#auth-email')).not.toBeNull();
  });
});
