import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { Trip } from '../../core/api/models';
import { ADVICE, COMPARISON } from './comparison/comparison.testing';
import { TripDetailsPage } from './trip-details-page';
import { CITIES, TRIP } from './trip-form.testing';

const TRIP_URL = 'http://api.test/api/trips/7';
const CITIES_URL = 'http://api.test/api/cities';
const COMPARISON_URL = `${TRIP_URL}/comparison`;
const ADVICE_URL = `${TRIP_URL}/advice`;
const NOT_FOUND = { title: 'Not Found', detail: 'Trip with id 7 not found', status: 404 };

describe('TripDetailsPage', () => {
  let fixture: ComponentFixture<TripDetailsPage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripDetailsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TripDetailsPage);
    fixture.componentRef.setInput('id', '7');
    page = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    httpTesting.expectOne(CITIES_URL).flush(CITIES); // for the route map
  });

  afterEach(() => httpTesting.verify());

  /** Answers the trip request; comparison and advice are then requested but left open. */
  async function loadTrip(trip: Trip = TRIP): Promise<void> {
    httpTesting.expectOne(TRIP_URL).flush(trip);
    // The follow-up resources start a microtask after the trip arrives. whenStable()
    // cannot be used here: it would wait for the requests this helper leaves open.
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  }

  /** Loads the trip and answers comparison and advice. */
  async function loadAll(trip: Trip = TRIP): Promise<void> {
    await loadTrip(trip);
    httpTesting.expectOne(COMPARISON_URL).flush(COMPARISON);
    httpTesting.expectOne(ADVICE_URL).flush(ADVICE);
    await fixture.whenStable();
  }

  function click(text: string): void {
    const button = Array.from(page.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(text),
    );
    if (!button) {
      throw new Error(`No button "${text}"`);
    }
    button.click();
  }

  function section(headingId: string): HTMLElement {
    return page.querySelector(`section[aria-labelledby="${headingId}"]`) as HTMLElement;
  }

  it('shows the trip details with an edit link', async () => {
    await loadAll();

    expect(page.querySelector('h1')?.textContent).toContain('Berlin to Vienna');
    const details = page.querySelector('dl')?.textContent ?? '';
    expect(details).toContain('Berlin (DE)');
    expect(details).toContain('Vienna (AT)');
    expect(details).toContain('Wednesday, May 20, 2099');
    expect(details).toContain('2 travelers');
    expect(details).toContain('Greenest');
    expect(details).toContain('Window seat');
    expect(page.querySelector('.actions a')?.getAttribute('href')).toBe('/trips/7/edit');
    expect(page.querySelector('app-route-map svg')?.getAttribute('role')).toBe('img');
    expect(page.querySelector('app-route-map svg')?.getAttribute('aria-label')).toBe(
      'Route from Berlin to Vienna, 524 km straight-line.',
    );
  });

  it('omits the notes row when the trip has no notes', async () => {
    await loadAll({ ...TRIP, notes: null });

    expect(page.querySelector('dl')?.textContent).not.toContain('Notes');
  });

  it('shows the trip first, then the recommendation and the comparison as they arrive', async () => {
    await loadTrip();

    expect(page.querySelector('h1')?.textContent).toContain('Berlin to Vienna');
    expect(section('advice-heading').querySelector('[role="status"]')?.textContent).toContain(
      'Asking the advisor',
    );
    expect(section('comparison-heading').querySelector('[role="status"]')?.textContent).toContain(
      'Comparing transport modes',
    );

    httpTesting.expectOne(COMPARISON_URL).flush(COMPARISON);
    httpTesting.expectOne(ADVICE_URL).flush(ADVICE);
    await fixture.whenStable();

    expect(section('advice-heading').textContent).toContain(
      'Take the train from Berlin to Vienna.',
    );
    expect(section('comparison-heading').querySelectorAll('tbody tr')).toHaveLength(3);
    expect(
      section('comparison-heading').querySelectorAll('app-comparison-chart .bar'),
    ).toHaveLength(2);
    expect(section('comparison-heading').textContent).toContain('Recommended');
    expect(page.querySelector('[role="status"]')).toBeNull();
  });

  it('keeps the comparison when only the advice fails, and retries the advice', async () => {
    await loadTrip();
    httpTesting.expectOne(COMPARISON_URL).flush(COMPARISON);
    httpTesting.expectOne(ADVICE_URL).error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(section('comparison-heading').querySelectorAll('tbody tr')).toHaveLength(3);
    expect(section('advice-heading').querySelector('[role="alert"]')?.textContent).toContain(
      'API unreachable',
    );

    click('Try again');
    TestBed.tick();
    httpTesting.expectOne(ADVICE_URL).flush(ADVICE);
    await fixture.whenStable();

    expect(section('advice-heading').textContent).toContain('Take the train');
  });

  it('shows one not-found error for an unknown trip and asks for nothing else', async () => {
    httpTesting.expectOne(TRIP_URL).flush(NOT_FOUND, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(page.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Trip with id 7 not found');
    expect(page.querySelector('dl')).toBeNull();
    httpTesting.expectNone(COMPARISON_URL);
    httpTesting.expectNone(ADVICE_URL);
  });

  it('deletes after confirmation and returns to the list', async () => {
    await loadAll();

    click('Delete');
    await fixture.whenStable();
    click('Yes, delete');
    TestBed.tick();
    httpTesting.expectOne({ method: 'DELETE', url: TRIP_URL }).flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    expect(navigate).toHaveBeenCalledWith(['/trips']);
  });

  it('stays on the page and shows an error when deleting fails', async () => {
    await loadAll();

    click('Delete');
    await fixture.whenStable();
    click('Yes, delete');
    TestBed.tick();
    httpTesting.expectOne({ method: 'DELETE', url: TRIP_URL }).error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    expect(navigate).not.toHaveBeenCalled();
  });
});
