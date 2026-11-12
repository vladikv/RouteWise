import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { AuthApi } from '../../core/api/auth-api';
import { ALICE } from '../../core/auth/auth.testing';
import { Session } from '../../core/auth/session';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let header: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Header);
    header = fixture.nativeElement as HTMLElement;
  });

  function logInAsAlice(): void {
    vi.spyOn(TestBed.inject(AuthApi), 'login').mockReturnValue(of(ALICE));
    TestBed.inject(Session).login({ email: ALICE.email, password: 'x' }).subscribe();
  }

  function buttonNamed(name: string): HTMLButtonElement | undefined {
    return Array.from(header.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === name,
    );
  }

  it('offers a login link when logged out', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const link = Array.from(header.querySelectorAll('a')).find(
      (anchor) => anchor.textContent?.trim() === 'Log in',
    );
    expect(link?.getAttribute('href')).toBe('/login');
    expect(buttonNamed('Log out')).toBeUndefined();
  });

  it('shows who is logged in and logs out', async () => {
    logInAsAlice();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(header.querySelector('.account__name')?.textContent?.trim()).toBe('Logged in as Alice');

    buttonNamed('Log out')?.click();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: 'http://api.test/api/auth/logout' })
      .flush(null);
    await fixture.whenStable();

    expect(TestBed.inject(Session).loggedIn()).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledWith('/');
    expect(header.textContent).toContain('Log in');
  });
});
