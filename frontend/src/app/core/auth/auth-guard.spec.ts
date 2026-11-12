import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { AuthApi } from '../api/auth-api';
import { authGuard, safeReturnUrl } from './auth-guard';
import { ALICE } from './auth.testing';
import { Session } from './session';

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function run(url: string): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('sends logged-out visitors to the login page with the page they wanted', () => {
    const result = run('/trips/new?from=3');

    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/login?returnUrl=%2Ftrips%2Fnew%3Ffrom%3D3');
  });

  it('lets logged-in users through', () => {
    vi.spyOn(TestBed.inject(AuthApi), 'login').mockReturnValue(of(ALICE));
    TestBed.inject(Session).login({ email: ALICE.email, password: 'x' }).subscribe();

    expect(run('/trips')).toBe(true);
  });
});

describe('safeReturnUrl', () => {
  it('keeps paths inside the app', () => {
    expect(safeReturnUrl('/trips/7')).toBe('/trips/7');
    expect(safeReturnUrl('/trips/new?from=3&to=23')).toBe('/trips/new?from=3&to=23');
  });

  it('falls back to the trip list for missing or outside targets', () => {
    expect(safeReturnUrl(undefined)).toBe('/trips');
    expect(safeReturnUrl('')).toBe('/trips');
    expect(safeReturnUrl('https://evil.example')).toBe('/trips');
    expect(safeReturnUrl('//evil.example')).toBe('/trips');
    expect(safeReturnUrl('/\\evil.example')).toBe('/trips');
    expect(safeReturnUrl('javascript:alert(1)')).toBe('/trips');
  });
});
