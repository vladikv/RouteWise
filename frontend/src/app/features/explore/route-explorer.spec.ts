import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { addDaysIso, todayIso } from '../../shared/util/date';
import { COMPARISON } from '../trips/comparison/comparison.testing';
import { CITIES } from '../trips/trip-form.testing';
import { RouteExplorer } from './route-explorer';

const CITIES_URL = 'http://api.test/api/cities';
const COMPARISONS_URL = 'http://api.test/api/comparisons';
const DEFAULT_DATE = addDaysIso(todayIso(), 7);

describe('RouteExplorer', () => {
  let fixture: ComponentFixture<RouteExplorer>;
  let httpTesting: HttpTestingController;
  let explorer: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteExplorer],
      providers: [
        provideRouter([{ path: '', children: [] }]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RouteExplorer);
    explorer = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    httpTesting.expectOne(CITIES_URL).flush(CITIES);
    await fixture.whenStable();
  });

  afterEach(() => httpTesting.verify());

  /** Lets a newly needed comparison request start (see the note in frontend/CLAUDE.md). */
  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  }

  async function pick(name: string): Promise<void> {
    const marker = Array.from(explorer.querySelectorAll('g.city')).find((g) =>
      g.getAttribute('aria-label')?.startsWith(name),
    );
    marker?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(explorer.querySelectorAll('button')).find(
      (candidate) =>
        candidate.textContent?.includes(text) || candidate.getAttribute('aria-label') === text,
    );
    if (!found) {
      throw new Error(`No button ${text}`);
    }
    return found;
  }

  async function pickRouteAndAnswer(): Promise<void> {
    await pick('Berlin');
    await pick('Vienna');
    httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
    await fixture.whenStable();
  }

  it('asks for two cities before comparing anything', async () => {
    expect(explorer.querySelector('.placeholder')?.textContent).toContain('Choose two cities');

    await pick('Berlin');

    httpTesting.expectNone(COMPARISONS_URL);
    expect(explorer.querySelectorAll('app-city-picker input')[0]).toHaveProperty('value', 'Berlin');
    expect(button('Clear From')).toBeTruthy();
    expect(() => button('Clear To')).toThrow();
  });

  it('compares as soon as both cities are picked, with the default settings', async () => {
    await pick('Berlin');
    await pick('Vienna');

    const call = httpTesting.expectOne({ method: 'POST', url: COMPARISONS_URL });
    expect(call.request.body).toEqual({
      originCityId: 3,
      destinationCityId: 23,
      departureDate: DEFAULT_DATE,
      travelers: 1,
      priority: 'BALANCED',
    });
    expect(explorer.querySelector('[role="status"]:not(.status)')?.textContent).toContain(
      'Comparing transport modes',
    );

    call.flush(COMPARISON);
    await fixture.whenStable();

    expect(explorer.querySelectorAll('app-comparison-chart .bar')).toHaveLength(2);
    expect(explorer.querySelector('.placeholder')).toBeNull();
  });

  it('re-runs the comparison when priority, travelers or direction change', async () => {
    await pickRouteAndAnswer();

    const greenest = explorer.querySelector(
      'app-priority-picker input[value="GREENEST"]',
    ) as HTMLInputElement;
    greenest.checked = true;
    greenest.dispatchEvent(new Event('change'));
    await settle();
    let call = httpTesting.expectOne(COMPARISONS_URL);
    expect(call.request.body.priority).toBe('GREENEST');
    call.flush(COMPARISON);
    await fixture.whenStable();

    button('One traveler more').click();
    await settle();
    call = httpTesting.expectOne(COMPARISONS_URL);
    expect(call.request.body.travelers).toBe(2);
    expect(explorer.querySelector('.stepper__value')?.textContent?.trim()).toMatch(/^2 /);
    call.flush(COMPARISON);
    await fixture.whenStable();

    button('Swap origin and destination').click();
    await settle();
    call = httpTesting.expectOne(COMPARISONS_URL);
    expect(call.request.body.originCityId).toBe(23);
    expect(call.request.body.destinationCityId).toBe(3);
    call.flush(COMPARISON);
    await fixture.whenStable();
  });

  it('keeps travelers between 1 and 9', async () => {
    expect(button('One traveler fewer').disabled).toBe(true);

    for (let i = 0; i < 12; i++) {
      button('One traveler more').click();
    }
    await fixture.whenStable();

    expect(explorer.querySelector('.stepper__value')?.textContent?.trim()).toMatch(/^9 /);
    expect(button('One traveler more').disabled).toBe(true);
  });

  it('links "Save as trip" to the trip form with the current selection', async () => {
    await pickRouteAndAnswer();

    const href = explorer.querySelector('a.button--primary')?.getAttribute('href') ?? '';
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/trips/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '3',
      to: '23',
      date: DEFAULT_DATE,
      travelers: '1',
      priority: 'BALANCED',
    });
  });

  it('shows a comparison error with retry, and clears the result with the selection', async () => {
    await pick('Berlin');
    await pick('Vienna');
    httpTesting.expectOne(COMPARISONS_URL).error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(explorer.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');

    button('Try again').click();
    await settle();
    httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
    await fixture.whenStable();
    expect(explorer.querySelector('app-comparison-chart')).not.toBeNull();

    button('Clear From').click();
    await fixture.whenStable();
    expect(explorer.querySelector('app-comparison-chart')).toBeNull();
    expect(explorer.querySelector('.placeholder')).not.toBeNull();
  });

  it('does not compare for a past date', async () => {
    const date = explorer.querySelector<HTMLInputElement>('#explorer-date') as HTMLInputElement;
    date.value = '2000-01-01';
    date.dispatchEvent(new Event('change'));
    await pick('Berlin');
    await pick('Vienna');

    httpTesting.expectNone(COMPARISONS_URL);
    expect(explorer.querySelector('.placeholder')).not.toBeNull();
  });

  it('lets the city pickers choose the route, in sync with the map', async () => {
    const [from, to] = Array.from(
      explorer.querySelectorAll<HTMLInputElement>('app-city-picker input'),
    );
    from.value = 'vie';
    from.dispatchEvent(new Event('input'));
    from.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    to.value = 'berl';
    to.dispatchEvent(new Event('input'));
    to.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();

    const call = httpTesting.expectOne(COMPARISONS_URL);
    expect(call.request.body.originCityId).toBe(23);
    expect(call.request.body.destinationCityId).toBe(3);
    call.flush(COMPARISON);
    await fixture.whenStable();
    expect(explorer.querySelector('app-route-map [role="status"]')?.textContent).toContain(
      'Route from Vienna to Berlin',
    );
  });

  it('keeps the previous results visible, dimmed, while a new comparison loads', async () => {
    await pickRouteAndAnswer();

    button('One traveler more').click();
    await settle();

    expect(explorer.querySelector('app-comparison-chart')).not.toBeNull();
    expect(explorer.querySelector('.results--refreshing')).not.toBeNull();
    expect(explorer.querySelector('.results')?.getAttribute('aria-busy')).toBe('true');

    httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
    await fixture.whenStable();
    expect(explorer.querySelector('.results--refreshing')).toBeNull();
  });

  it('sets the date from a quick pick and says whether a forecast exists', async () => {
    const tomorrow = Array.from(explorer.querySelectorAll<HTMLButtonElement>('.chip')).find(
      (chip) => chip.textContent?.includes('Tomorrow'),
    ) as HTMLButtonElement;
    tomorrow.click();
    await fixture.whenStable();

    expect(explorer.querySelector<HTMLInputElement>('#explorer-date')?.value).toBe(
      addDaysIso(todayIso(), 1),
    );
    expect(tomorrow.getAttribute('aria-pressed')).toBe('true');
    expect(explorer.querySelector('#explorer-forecast')?.textContent).toContain(
      'Weather forecast included',
    );

    const date = explorer.querySelector('#explorer-date') as HTMLInputElement;
    date.value = addDaysIso(todayIso(), 30);
    date.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(explorer.querySelector('#explorer-forecast')?.textContent).toContain(
      'Forecast not available yet',
    );
  });

  it('writes the selection to the URL, leaving defaults out', async () => {
    const router = TestBed.inject(Router);
    await pickRouteAndAnswer();
    await fixture.whenStable();

    expect(router.url).toBe('/?from=3&to=23');

    button('One traveler more').click();
    await settle();
    httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
    await fixture.whenStable();
    expect(router.url).toBe('/?from=3&to=23&travelers=2');
  });

  it('restores the selection from the URL and ignores invalid values', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?from=23&to=3&travelers=4&priority=FASTEST');
    await settle();

    const call = httpTesting.expectOne(COMPARISONS_URL);
    expect(call.request.body).toEqual({
      originCityId: 23,
      destinationCityId: 3,
      departureDate: DEFAULT_DATE,
      travelers: 4,
      priority: 'FASTEST',
    });
    call.flush(COMPARISON);
    await fixture.whenStable();

    await router.navigateByUrl('/?from=999&to=3&travelers=40&priority=LUXURY&date=yesterday');
    await settle();
    httpTesting.expectNone(COMPARISONS_URL);
    expect(explorer.querySelectorAll<HTMLInputElement>('app-city-picker input')[0].value).toBe('');
    expect(explorer.querySelector('.stepper__value')?.textContent?.trim()).toMatch(/^1 /);
    expect(
      (explorer.querySelector('app-priority-picker input:checked') as HTMLInputElement).value,
    ).toBe('BALANCED');
  });
});
