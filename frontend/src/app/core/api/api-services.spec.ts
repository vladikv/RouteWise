import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdvisorApi } from './advisor-api';
import { AuthApi } from './auth-api';
import { API_BASE_URL } from './api-config';
import { CityApi } from './city-api';
import { ComparisonApi } from './comparison-api';
import { TripRequest } from './models';
import { TransportModeApi } from './transport-mode-api';
import { TripApi } from './trip-api';

const BASE = 'http://api.test';

describe('API services', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  describe('TripApi', () => {
    const request: TripRequest = {
      title: 'Berlin to Vienna',
      stops: [{ cityId: 3 }, { cityId: 23 }],
      departureDate: '2026-11-20',
      travelers: 2,
      priority: 'GREENEST',
    };

    it('searches trips without params by default', () => {
      TestBed.inject(TripApi).search().subscribe();

      const call = httpTesting.expectOne((req) => req.url === `${BASE}/api/trips`);
      expect(call.request.method).toBe('GET');
      expect(call.request.params.keys()).toEqual([]);
    });

    it('sends search params, repeating priority and mode', () => {
      TestBed.inject(TripApi)
        .search({
          q: 'vienna',
          priority: ['FASTEST', 'GREENEST'],
          mode: ['TRAIN', 'BUS'],
          sort: 'cost',
          direction: 'desc',
          page: 0,
          size: 100,
        })
        .subscribe();

      const params = httpTesting.expectOne((req) => req.url === `${BASE}/api/trips`).request.params;
      expect(params.get('q')).toBe('vienna');
      expect(params.getAll('priority')).toEqual(['FASTEST', 'GREENEST']);
      expect(params.getAll('mode')).toEqual(['TRAIN', 'BUS']);
      expect(params.get('sort')).toBe('cost');
      expect(params.get('direction')).toBe('desc');
      expect(params.get('page')).toBe('0');
      expect(params.get('size')).toBe('100');
    });

    it('does not send empty values', () => {
      TestBed.inject(TripApi)
        .search({ q: '', priority: [], mode: [], from: undefined, size: 100 })
        .subscribe();

      const params = httpTesting.expectOne((req) => req.url === `${BASE}/api/trips`).request.params;
      expect(params.keys()).toEqual(['size']);
    });

    it('loads stats and a single trip', () => {
      const api = TestBed.inject(TripApi);

      api.stats().subscribe();
      api.findById(7).subscribe();

      expect(httpTesting.expectOne(`${BASE}/api/trips/stats`).request.method).toBe('GET');
      expect(httpTesting.expectOne(`${BASE}/api/trips/7`).request.method).toBe('GET');
    });

    it('restores a deleted trip with an empty POST', () => {
      TestBed.inject(TripApi).restore(7).subscribe();

      const call = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/trips/7/restore` });
      expect(call.request.body).toBeNull();
    });

    it('creates, updates and deletes trips', () => {
      const api = TestBed.inject(TripApi);

      api.create(request).subscribe();
      api.update(7, request).subscribe();
      api.delete(7).subscribe();

      const create = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/trips` });
      expect(create.request.body).toEqual(request);
      const update = httpTesting.expectOne({ method: 'PUT', url: `${BASE}/api/trips/7` });
      expect(update.request.body).toEqual(request);
      httpTesting.expectOne({ method: 'DELETE', url: `${BASE}/api/trips/7` });
    });

    it('loads comparison and advice of a trip', () => {
      const api = TestBed.inject(TripApi);

      api.compare(7).subscribe();
      api.advise(7).subscribe();

      httpTesting.expectOne({ method: 'GET', url: `${BASE}/api/trips/7/comparison` });
      httpTesting.expectOne({ method: 'GET', url: `${BASE}/api/trips/7/advice` });
    });
  });

  describe('CityApi', () => {
    it('lists all cities without a query', () => {
      TestBed.inject(CityApi).findAll().subscribe();

      const call = httpTesting.expectOne(`${BASE}/api/cities`);
      expect(call.request.params.keys()).toEqual([]);
    });

    it('sends a trimmed query and ignores a blank one', () => {
      const api = TestBed.inject(CityApi);

      api.findAll('  ber ').subscribe();
      api.findAll('   ').subscribe();

      httpTesting.expectOne(`${BASE}/api/cities?q=ber`);
      httpTesting.expectOne(`${BASE}/api/cities`);
    });
  });

  describe('TransportModeApi', () => {
    it('lists transport modes', () => {
      TestBed.inject(TransportModeApi).findAll().subscribe();

      httpTesting.expectOne({ method: 'GET', url: `${BASE}/api/transport-modes` });
    });
  });

  describe('ComparisonApi', () => {
    it('posts a route to compare without saving a trip', () => {
      const request = {
        stops: [{ cityId: 3 }, { cityId: 23 }],
        departureDate: '2026-11-20',
        travelers: 2,
        priority: 'GREENEST' as const,
      };

      TestBed.inject(ComparisonApi).preview(request).subscribe();

      const call = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/comparisons` });
      expect(call.request.body).toEqual(request);
    });
  });

  describe('AuthApi', () => {
    it('calls the session endpoints', () => {
      const api = TestBed.inject(AuthApi);
      const credentials = { email: 'alice@example.com', password: 'correct horse' };

      api.me().subscribe();
      api.login(credentials).subscribe();
      api.register({ ...credentials, displayName: 'Alice' }).subscribe();
      api.logout().subscribe();

      httpTesting.expectOne({ method: 'GET', url: `${BASE}/api/auth/me` });
      const login = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/auth/login` });
      expect(login.request.body).toEqual(credentials);
      const register = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/auth/register` });
      expect(register.request.body).toEqual({ ...credentials, displayName: 'Alice' });
      httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/auth/logout` });
    });
  });

  describe('AdvisorApi', () => {
    it('posts the free text to parse', () => {
      TestBed.inject(AdvisorApi).parse('Berlin to Vienna tomorrow').subscribe();

      const call = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/advisor/parse` });
      expect(call.request.body).toEqual({ text: 'Berlin to Vienna tomorrow' });
    });
  });
});
