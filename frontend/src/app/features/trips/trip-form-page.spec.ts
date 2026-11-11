import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { DRAFT } from './comparison/comparison.testing';
import { TripFormPage } from './trip-form-page';
import { CITIES, TRIP, choose, errorText, fillValidTrip, typeInto } from './trip-form.testing';

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

  /** Submits the trip form (the last form on the page; the first is the description input). */
  function submitTrip(): void {
    const forms = page.querySelectorAll('form');
    forms[forms.length - 1].dispatchEvent(new Event('submit'));
  }

  async function openNew(): Promise<void> {
    fixture.detectChanges();
    httpTesting.expectOne(`${API}/cities`).flush(CITIES);
    await fixture.whenStable();
  }

  it('creates a trip and opens its details', async () => {
    await openNew();
    expect(page.querySelector('h1')?.textContent).toContain('New trip');

    fillValidTrip(page);
    submitTrip();
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

    submitTrip();
    TestBed.tick();

    const call = httpTesting.expectOne({ method: 'PUT', url: `${API}/trips/7` });
    expect(call.request.body.travelers).toBe(2);
    call.flush(TRIP);

    expect(navigate).toHaveBeenCalledWith(['/trips', 7]);
  });

  it('shows API field errors on the form and stays on the page', async () => {
    await openNew();
    fillValidTrip(page);
    submitTrip();
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
    expect(page.querySelector<HTMLButtonElement>('.actions button[type="submit"]')?.disabled).toBe(
      false,
    );
  });

  it('shows a general error when saving fails', async () => {
    await openNew();
    fillValidTrip(page);
    submitTrip();
    TestBed.tick();

    httpTesting
      .expectOne({ method: 'POST', url: `${API}/trips` })
      .error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    expect(page.querySelector('#trip-title')).not.toBeNull();
  });

  function describeTrip(text: string): void {
    typeInto(page, '#trip-description', text);
    page.querySelectorAll('form')[0].dispatchEvent(new Event('submit'));
    TestBed.tick();
  }

  it('fills the form from a free-text description and shows the advisor warnings', async () => {
    await openNew();

    describeTrip('From Berlin on 20 May 2099 with 2 friends, cheap');
    const call = httpTesting.expectOne({ method: 'POST', url: `${API}/advisor/parse` });
    expect(call.request.body).toEqual({ text: 'From Berlin on 20 May 2099 with 2 friends, cheap' });
    call.flush(DRAFT);
    await fixture.whenStable();

    expect(page.querySelector('[role="status"]')?.textContent).toContain(
      'No destination city recognised.',
    );
    expect(page.querySelector<HTMLInputElement>('#trip-title')?.value).toBe('Berlin to Vienna');
    expect(page.querySelector<HTMLInputElement>('#trip-travelers')?.value).toBe('3');

    choose(page, '#trip-destination', 'Vienna');
    submitTrip();
    TestBed.tick();

    const create = httpTesting.expectOne({ method: 'POST', url: `${API}/trips` });
    expect(create.request.body).toEqual({
      title: 'Berlin to Vienna',
      originCityId: 3,
      destinationCityId: 23,
      departureDate: '2099-05-20',
      travelers: 3,
      priority: 'CHEAPEST',
      notes: null,
    });
    create.flush({ ...TRIP, id: 12 });
    expect(navigate).toHaveBeenCalledWith(['/trips', 12]);
  });

  it('shows an error and keeps the form usable when the description cannot be read', async () => {
    await openNew();
    fillValidTrip(page);

    describeTrip('Berlin to Vienna');
    httpTesting
      .expectOne({ method: 'POST', url: `${API}/advisor/parse` })
      .error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    expect(page.querySelector<HTMLInputElement>('#trip-title')?.value).toBe('  Berlin to Vienna ');
  });

  it('offers the description input only for new trips', async () => {
    fixture.componentRef.setInput('id', '7');
    fixture.detectChanges();
    httpTesting.expectOne(`${API}/cities`).flush(CITIES);
    httpTesting.expectOne(`${API}/trips/7`).flush(TRIP);
    await fixture.whenStable();

    expect(page.querySelector('#trip-description')).toBeNull();
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
