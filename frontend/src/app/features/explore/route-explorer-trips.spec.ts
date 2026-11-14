import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { AuthApi } from '../../core/api/auth-api';
import { TripPage } from '../../core/api/models';
import { ALICE } from '../../core/auth/auth.testing';
import { Session } from '../../core/auth/session';
import { todayIso } from '../../shared/util/date';
import { COMPARISON } from '../trips/comparison/comparison.testing';
import { CITIES, TRIP } from '../trips/trip-form.testing';
import { MY_TRIPS_LAYER_STORAGE_KEY } from './my-trips-layer';
import { RouteExplorer } from './route-explorer';

const API = 'http://api.test/api';

const PAGE: TripPage = {
  items: [
    { ...TRIP, id: 7, figures: null },
    {
      ...TRIP,
      id: 8,
      title: 'Prague trip',
      departureDate: '2099-06-01',
      stops: [
        { cityId: 18, cityName: 'Prague', country: 'CZ', position: 0 },
        { cityId: 3, cityName: 'Berlin', country: 'DE', position: 1 },
      ],
      figures: null,
    },
  ],
  page: 0,
  size: 20,
  totalItems: 2,
  totalPages: 1,
  currency: 'EUR',
  facets: { priorities: [], modes: [] },
  priorityTotals: [],
};

describe('RouteExplorer my trips layer', () => {
  let fixture: ComponentFixture<RouteExplorer>;
  let httpTesting: HttpTestingController;
  let explorer: HTMLElement;

  beforeEach(() => {
    // Reduced motion: the globe does not turn while the specs look at it.
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', children: [] }]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const tripRequests = () =>
    httpTesting.match((request) => request.url === `${API}/trips` && request.method === 'GET');

  async function open(loggedIn: boolean): Promise<void> {
    if (loggedIn) {
      vi.spyOn(TestBed.inject(AuthApi), 'login').mockReturnValue(of(ALICE));
      TestBed.inject(Session).login({ email: ALICE.email, password: 'x' }).subscribe();
    }
    fixture = TestBed.createComponent(RouteExplorer);
    explorer = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    httpTesting.expectOne(`${API}/cities`).flush(CITIES);
    await settle();
  }

  /** Lets requests that became necessary start; the trips request stays open, so no whenStable here. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  async function answer(page: TripPage = PAGE): Promise<void> {
    const [call] = tripRequests();
    call.flush(page);
    await fixture.whenStable();
  }

  const arcs = () => explorer.querySelectorAll('path.trip-arc');
  const toggle = () =>
    explorer.querySelector('button[aria-label="Show my trips"]') as HTMLButtonElement;

  it('asks for the next 20 upcoming trips by date, from today', async () => {
    await open(true);

    const [call, ...others] = tripRequests();
    expect(others).toHaveLength(0);
    expect(call.request.params.get('from')).toBe(todayIso());
    expect(call.request.params.get('sort')).toBe('date');
    expect(call.request.params.get('direction')).toBe('asc');
    expect(call.request.params.get('size')).toBe('20');
    call.flush(PAGE);
    await fixture.whenStable();

    expect(arcs()).toHaveLength(2);
  });

  it('shows no layer, no toggle and asks for nothing when logged out', async () => {
    await open(false);

    expect(tripRequests()).toHaveLength(0);
    expect(arcs()).toHaveLength(0);
    expect(toggle()).toBeNull();
  });

  it('shows no layer, and does not break the map, when the trips cannot be loaded', async () => {
    await open(true);
    tripRequests()[0].error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(arcs()).toHaveLength(0);
    expect(toggle()).toBeNull();
    expect(explorer.querySelector('app-route-map svg')).not.toBeNull();
  });

  it('shows no layer for a user without upcoming trips', async () => {
    await open(true);
    await answer({ ...PAGE, items: [], totalItems: 0, totalPages: 0 });

    expect(arcs()).toHaveLength(0);
    expect(toggle()).toBeNull();
  });

  it('shows the title and date on hover and opens the trip on click', async () => {
    await open(true);
    await answer();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const hit = explorer.querySelectorAll('path.trip-hit')[1];

    hit.dispatchEvent(new MouseEvent('pointerenter', { clientX: 200, clientY: 200 }));
    fixture.detectChanges();
    expect(explorer.querySelector('.card-tip')?.textContent).toContain('Prague trip');
    expect(explorer.querySelector('.card-tip')?.textContent).toContain('Jun 1, 2099');

    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigate).toHaveBeenCalledWith(['/trips', 8]);
  });

  it('fades the arcs while a route is selected', async () => {
    await open(true);
    await answer();
    const group = () => explorer.querySelector('g.trip-arcs') as SVGGElement;
    expect(group().classList).not.toContain('trip-arcs--faded');

    for (const name of ['Berlin', 'Vienna']) {
      const marker = Array.from(explorer.querySelectorAll('g.city')).find((city) =>
        city.getAttribute('aria-label')?.startsWith(name),
      );
      marker?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
    }
    httpTesting.expectOne(`${API}/comparisons`).flush(COMPARISON);
    await settle();

    expect(group().classList).toContain('trip-arcs--faded');
  });

  it('toggles the layer with a labelled button and remembers the choice', async () => {
    await open(true);
    await answer();

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    toggle().click();
    fixture.detectChanges();

    expect(arcs()).toHaveLength(0);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem(MY_TRIPS_LAYER_STORAGE_KEY)).toBe('false');
  });

  it('starts hidden when the saved choice is off', async () => {
    localStorage.setItem(MY_TRIPS_LAYER_STORAGE_KEY, 'false');
    await open(true);
    await answer();

    expect(arcs()).toHaveLength(0);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('still toggles for this visit when the storage fails', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    await open(true);
    await answer();
    expect(arcs()).toHaveLength(2);

    toggle().click();
    fixture.detectChanges();

    expect(arcs()).toHaveLength(0);
  });
});
