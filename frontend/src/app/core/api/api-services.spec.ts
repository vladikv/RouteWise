import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdvisorApi } from './advisor-api';
import { API_BASE_URL } from './api-config';
import { CityApi } from './city-api';
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
      originCityId: 3,
      destinationCityId: 23,
      departureDate: '2026-11-20',
      travelers: 2,
      priority: 'GREENEST',
    };

    it('lists and loads trips', () => {
      const api = TestBed.inject(TripApi);

      api.findAll().subscribe();
      api.findById(7).subscribe();

      expect(httpTesting.expectOne(`${BASE}/api/trips`).request.method).toBe('GET');
      expect(httpTesting.expectOne(`${BASE}/api/trips/7`).request.method).toBe('GET');
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

  describe('AdvisorApi', () => {
    it('posts the free text to parse', () => {
      TestBed.inject(AdvisorApi).parse('Berlin to Vienna tomorrow').subscribe();

      const call = httpTesting.expectOne({ method: 'POST', url: `${BASE}/api/advisor/parse` });
      expect(call.request.body).toEqual({ text: 'Berlin to Vienna tomorrow' });
    });
  });
});
