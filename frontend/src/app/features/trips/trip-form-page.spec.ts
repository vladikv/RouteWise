import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { TripFormPage } from './trip-form-page';
import { CITIES, TRIP, errorText, fillValidTrip, submit } from './trip-form.testing';

const API = 'http://api.test/api';

describe('TripFormPage', () => {
  let fixture: ComponentFixture<TripFormPage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripFormPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TripFormPage);
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => httpTesting.verify());

  async function openNew(): Promise<void> {
    fixture.detectChanges();
    httpTesting.expectOne(`${API}/cities`).flush(CITIES);
    await fixture.whenStable();
  }

  it('creates a trip and opens its details', async () => {
    await openNew();
    expect(page.querySelector('h1')?.textContent).toContain('New trip');

    fillValidTrip(page);
    submit(page);
    TestBed.tick();

    const call = httpTesting.expectOne({ method: 'POST', url: `${API}/trips` });
    expect(call.request.body.title).toBe('Berlin to Vienna');
    expect(call.request.body.originCityId).toBe(3);
    call.flush({ ...TRIP, id: 12 });

    expect(navigate).toHaveBeenCalledWith(['/trips', 12]);
  });

  it('loads a trip for editing, updates it and returns to its details', async () => {
    fixture.componentRef.setInput('id', '7');
    fixture.detectChanges();
    httpTesting.expectOne(`${API}/cities`).flush(CITIES);
    httpTesting.expectOne(`${API}/trips/7`).flush(TRIP);
    await fixture.whenStable();

    expect(page.querySelector('h1')?.textContent).toContain('Edit trip');
    expect(page.querySelector<HTMLInputElement>('#trip-title')?.value).toBe('Berlin to Vienna');
    expect(page.querySelector('a.button:not(.button--primary)')?.getAttribute('href')).toBe(
      '/trips/7',
    );

    submit(page);
    TestBed.tick();

    const call = httpTesting.expectOne({ method: 'PUT', url: `${API}/trips/7` });
    expect(call.request.body.travelers).toBe(2);
    call.flush(TRIP);

    expect(navigate).toHaveBeenCalledWith(['/trips', 7]);
  });

  it('shows API field errors on the form and stays on the page', async () => {
    await openNew();
    fillValidTrip(page);
    submit(page);
    TestBed.tick();

    httpTesting.expectOne({ method: 'POST', url: `${API}/trips` }).flush(
      {
        title: 'Validation failed',
        detail: 'Request validation failed',
        status: 400,
        errors: [{ field: 'departureDate', message: 'must be today or later' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(errorText(page, 'trip-date')).toBe('Must be today or later.');
    expect(navigate).not.toHaveBeenCalled();
    expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it('shows a general error when saving fails', async () => {
    await openNew();
    fillValidTrip(page);
    submit(page);
    TestBed.tick();

    httpTesting
      .expectOne({ method: 'POST', url: `${API}/trips` })
      .error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    expect(page.querySelector('#trip-title')).not.toBeNull();
  });

  it('shows an error instead of the form when the trip to edit does not exist', async () => {
    fixture.componentRef.setInput('id', '99');
    fixture.detectChanges();
    httpTesting.expectOne(`${API}/cities`).flush(CITIES);
    httpTesting
      .expectOne(`${API}/trips/99`)
      .flush(
        { title: 'Not Found', detail: 'Trip with id 99 not found', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Trip with id 99 not found',
    );
    expect(page.querySelector('form')).toBeNull();
  });
});
