import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError, apiErrorInterceptor, toApiError } from './api-error';

describe('toApiError', () => {
  it('maps a validation Problem Detail with field errors', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 400,
        error: {
          title: 'Validation failed',
          detail: 'Request validation failed',
          status: 400,
          errors: [{ field: 'title', message: 'must not be blank' }, { bogus: true }],
        },
      }),
    );

    expect(error.status).toBe(400);
    expect(error.title).toBe('Validation failed');
    expect(error.detail).toBe('Request validation failed');
    expect(error.fieldErrors).toEqual([{ field: 'title', message: 'must not be blank' }]);
    expect(error.isValidation).toBe(true);
    expect(error.isNotFound).toBe(false);
  });

  it('treats a 409 with field errors as errors to show on the form', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 409,
        error: {
          title: 'Conflict',
          detail: 'email is already registered',
          status: 409,
          errors: [{ field: 'email', message: 'is already registered' }],
        },
      }),
    );

    expect(error.isValidation).toBe(true);
    expect(error.fieldErrors).toEqual([{ field: 'email', message: 'is already registered' }]);
  });

  it('maps a 404 Problem Detail', () => {
    const error = toApiError(
      new HttpErrorResponse({
        status: 404,
        error: { title: 'Not Found', detail: 'Trip with id 9 not found', status: 404 },
      }),
    );

    expect(error.isNotFound).toBe(true);
    expect(error.detail).toBe('Trip with id 9 not found');
    expect(error.fieldErrors).toEqual([]);
  });

  it('explains an unreachable API (status 0)', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
    );

    expect(error.status).toBe(0);
    expect(error.title).toBe('API unreachable');
    expect(error.detail).toContain('Cannot reach the RouteWise API');
  });

  it('falls back to a generic message for a non-Problem-Detail body', () => {
    const error = toApiError(
      new HttpErrorResponse({ status: 502, error: '<html>Bad Gateway</html>' }),
    );

    expect(error.title).toBe('Request failed');
    expect(error.detail).toBe('The request failed with status 502.');
  });
});

describe('apiErrorInterceptor', () => {
  it('turns failed requests into ApiError', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const http = TestBed.inject(HttpClient);
    const httpTesting = TestBed.inject(HttpTestingController);
    let received: unknown;

    http.get('/api/trips/9').subscribe({ error: (error: unknown) => (received = error) });
    httpTesting
      .expectOne('/api/trips/9')
      .flush(
        { title: 'Not Found', detail: 'Trip with id 9 not found', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );

    expect(received).toBeInstanceOf(ApiError);
    expect((received as ApiError).isNotFound).toBe(true);
    httpTesting.verify();
  });
});
