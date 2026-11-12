import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { Comparison, Trip } from '../../core/api/models';
import { COMPARISON, MULTI_COMPARISON } from './comparison/comparison.testing';
import { TripListPage } from './trip-list-page';
import { TRIP } from './trip-form.testing';

const TRIPS_URL = 'http://api.test/api/trips';
const SOLO_TRIP: Trip = {
  ...TRIP,
  id: 8,
  title: 'Solo to Paris',
  travelers: 1,
  priority: 'FASTEST',
  stops: [
    { cityId: 3, cityName: 'Berlin', country: 'DE', position: 0 },
    { cityId: 9, cityName: 'Paris', country: 'FR', position: 1 },
  ],
};

/** Train on one leg with a car alternative (saves 71.7 kg); mixed train and bus without a car. */
const FIGURES: Record<number, Comparison> = { 7: COMPARISON, 8: MULTI_COMPARISON };

describe('TripListPage', () => {
  let fixture: ComponentFixture<TripListPage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TripListPage);
    page = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => httpTesting.verify());

  /** Flushes the list, then one comparison per trip (`null` makes that request fail). */
  async function load(
    trips: Trip[],
    comparisons: Record<number, Comparison | null> = FIGURES,
  ): Promise<void> {
    httpTesting.expectOne(TRIPS_URL).flush(trips);
    for (const trip of trips) {
      const request = httpTesting.expectOne(`${TRIPS_URL}/${trip.id}/comparison`);
      const comparison = comparisons[trip.id];
      if (comparison) {
        request.flush(comparison);
      } else {
        request.error(new ProgressEvent('error'));
      }
    }
    await fixture.whenStable();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  function buttonByText(root: Element, text: string): HTMLButtonElement {
    const button = Array.from(root.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(text),
    );
    if (!button) {
      throw new Error(`No button "${text}"`);
    }
    return button;
  }

  function buttonOrNull(text: string): HTMLButtonElement | null {
    return (
      Array.from(page.querySelectorAll('button')).find((candidate) =>
        candidate.textContent?.includes(text),
      ) ?? null
    );
  }

  function chip(label: string): HTMLButtonElement {
    const button = Array.from(page.querySelectorAll('app-filter-group button')).find(
      (candidate) => candidate.getAttribute('aria-label')?.startsWith(label) ?? false,
    );
    if (!button) {
      throw new Error(`No chip "${label}"`);
    }
    return button as HTMLButtonElement;
  }

  async function search(text: string): Promise<void> {
    const input = page.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  function rows(): HTMLElement[] {
    return Array.from(page.querySelectorAll<HTMLElement>('tbody tr'));
  }

  function kpiValues(): string[] {
    return Array.from(page.querySelectorAll('app-stat-chip')).map((element) =>
      (element.querySelector('.value')?.textContent ?? '').trim(),
    );
  }

  function menuButton(title: string): HTMLButtonElement {
    return page.querySelector<HTMLButtonElement>(`button[aria-label="Actions for ${title}"]`)!;
  }

  it('shows a loading state, then the trips as a list with links and labels', async () => {
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading trips');

    await load([TRIP, SOLO_TRIP]);

    expect(page.querySelector('h1')?.textContent).toBe('Trips');
    expect(rows()).toHaveLength(2);
    expect(rows()[0].querySelector('th a')?.textContent).toContain('Berlin to Vienna');
    expect(rows()[0].querySelector('th a')?.getAttribute('href')).toBe('/trips/7');
    expect(rows()[0].textContent).toMatch(/Berlin\s+to\s+Vienna/);
    expect(rows()[0].textContent).toContain('May 20, 2099');
    expect(rows()[0].textContent).toContain('€151');
    expect(rows()[0].textContent).toContain('44 kg');
    expect(rows()[0].textContent).toContain('Train');
    expect(rows()[1].textContent).toContain('Mixed: train, bus');
    expect(page.querySelector('a[href="/trips/new"]')?.textContent).toContain('New trip');
  });

  it('shows KPIs from the comparisons and a note about left-out trips', async () => {
    httpTesting.expectOne(TRIPS_URL).flush([TRIP, SOLO_TRIP]);
    TestBed.tick();
    await Promise.resolve();
    fixture.detectChanges();

    expect(page.querySelector('app-stat-chip[aria-busy="true"]')).not.toBeNull();
    expect(page.querySelector('[aria-busy="true"] .visually-hidden')?.textContent).toBeTruthy();
    expect(page.querySelector('.kpis__note')).toBeNull();

    httpTesting.expectOne(`${TRIPS_URL}/7/comparison`).flush(COMPARISON);
    httpTesting.expectOne(`${TRIPS_URL}/8/comparison`).flush(MULTI_COMPARISON);
    await settle();

    expect(kpiValues()).toEqual(['2', '72 kg', '€104']);
    expect(page.textContent).toContain('Trips planned');
    expect(page.textContent).toContain('CO₂ saved vs car');
    expect(page.textContent).toContain('Average cost per trip');
    expect(page.querySelector('.kpis__note')?.textContent).toContain('Based on 1 of 2 trips');
  });

  it('shows a placeholder while a trip is loading and a message when its comparison failed', async () => {
    httpTesting.expectOne(TRIPS_URL).flush([TRIP, SOLO_TRIP]);
    TestBed.tick();
    await Promise.resolve();
    fixture.detectChanges();

    expect(rows()[0].querySelector('[aria-busy="true"]')).not.toBeNull();

    httpTesting.expectOne(`${TRIPS_URL}/7/comparison`).flush(COMPARISON);
    httpTesting.expectOne(`${TRIPS_URL}/8/comparison`).error(new ProgressEvent('error'));
    await settle();

    expect(rows()[0].querySelector('[aria-busy="true"]')).toBeNull();
    expect(rows()[1].textContent).toContain('Figures unavailable');
    expect(kpiValues()).toEqual(['2', '72 kg', '€151']);
    expect(page.querySelector('.kpis__note')?.textContent).toContain('Based on 1 of 2 trips');
  });

  it('shows an empty state with a call to action', async () => {
    await load([]);

    expect(page.textContent).toContain('No trips yet');
    expect(page.querySelector('.empty-state a')?.getAttribute('href')).toBe('/trips/new');
    expect(page.querySelector('app-stat-chip')).toBeNull();
    expect(page.querySelector('input[type="search"]')).toBeNull();
  });

  it('shows the load error and retries', async () => {
    httpTesting.expectOne(TRIPS_URL).error(new ProgressEvent('error'));
    await fixture.whenStable();

    buttonByText(page, 'Try again').click();
    TestBed.tick();
    await load([TRIP]);

    expect(rows()).toHaveLength(1);
  });

  it('searches titles and stop cities, ignoring case', async () => {
    await load([TRIP, SOLO_TRIP]);

    await search('PARIS');
    expect(rows().map((row) => row.querySelector('th a')?.textContent)).toEqual(['Solo to Paris']);

    await search('vienna');
    expect(rows().map((row) => row.querySelector('th a')?.textContent)).toEqual([
      'Berlin to Vienna',
    ]);
    expect(page.querySelector('app-stat-chip .value')?.textContent).toContain('2');
  });

  it('filters by priority and by recommended mode with pressed chips', async () => {
    await load([TRIP, SOLO_TRIP]);

    chip('Fastest').click();
    await settle();
    expect(chip('Fastest').getAttribute('aria-pressed')).toBe('true');
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('Solo to Paris');
    chip('Fastest').click();
    await settle();
    expect(rows()).toHaveLength(2);

    chip('Bus').click();
    await settle();
    expect(rows().map((row) => row.querySelector('th a')?.textContent)).toEqual(['Solo to Paris']);

    chip('Plane').click();
    chip('Bus').click();
    await settle();
    expect(page.textContent).toContain('No trips match your filters');
  });

  it('shows a no-matches state and clears the filters', async () => {
    await load([TRIP, SOLO_TRIP]);
    chip('Cheapest').click();
    await search('nowhere');

    expect(page.textContent).toContain('No trips match your filters');
    expect(rows()).toHaveLength(0);

    buttonByText(page, 'Clear filters').click();
    await settle();

    expect(rows()).toHaveLength(2);
    expect(page.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    expect(chip('Cheapest').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows "N of M trips" that follows the filters, and Clear filters resets search and chips', async () => {
    await load([TRIP, SOLO_TRIP]);
    const summary = () =>
      page.querySelector('app-trip-toolbar [role="status"]')?.textContent?.trim();
    expect(summary()).toBe('2 of 2 trips');
    expect(buttonOrNull('Clear filters')).toBeNull();

    chip('Fastest').click();
    await search('paris');
    expect(summary()).toBe('1 of 2 trips');

    buttonByText(page, 'Clear filters').click();
    await settle();

    expect(summary()).toBe('2 of 2 trips');
    expect(page.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    expect(chip('Fastest').getAttribute('aria-pressed')).toBe('false');
    expect(buttonOrNull('Clear filters')).toBeNull();
  });

  it('counts trips per priority and per recommended mode from the full list', async () => {
    await load([TRIP, SOLO_TRIP]);
    chip('Bus').click();
    await settle();

    expect(chip('Fastest').getAttribute('aria-label')).toBe('Fastest, 1 trip');
    expect(chip('Cheapest').getAttribute('aria-label')).toBe('Cheapest, 0 trips');
    expect(chip('Train').getAttribute('aria-label')).toBe('Train, 2 trips');
    expect(chip('Bus').getAttribute('aria-label')).toBe('Bus, 1 trip');
    expect(chip('Plane').getAttribute('aria-label')).toBe('Plane, 0 trips');
  });

  it('switches between the board and the list', async () => {
    await load([TRIP, SOLO_TRIP]);
    const radio = (label: string) =>
      Array.from(page.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((button) =>
        button.textContent?.includes(label),
      )!;

    expect(page.querySelector('app-trip-board')).toBeNull();

    radio('Board').click();
    await settle();

    const board = page.querySelector('app-trip-board')!;
    expect(page.querySelector('table')).toBeNull();
    expect(board.querySelector('[role="region"]')?.getAttribute('tabindex')).toBe('0');
    const headings = Array.from(board.querySelectorAll('h2')).map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings).toEqual([
      'Fastest 1 trips',
      'Cheapest 0 trips',
      'Greenest 1 trips',
      'Balanced 0 trips',
    ]);
    expect(board.textContent).toContain('€151 total');
    expect(board.querySelectorAll('app-trip-card')).toHaveLength(2);
    expect(board.textContent).toContain('No trips');

    chip('Greenest').click();
    await settle();
    expect(board.querySelectorAll('h2')).toHaveLength(1);

    radio('List').click();
    await settle();
    expect(page.querySelector('app-trip-board')).toBeNull();
    expect(page.querySelector('table')).not.toBeNull();
  });

  it('opens the actions menu, closes it with Escape and returns focus', async () => {
    await load([TRIP]);
    const trigger = menuButton('Berlin to Vienna');

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = page.querySelector(`#${trigger.getAttribute('aria-controls')}`)!;
    expect(menu.querySelector('a[aria-label="Open Berlin to Vienna"]')?.getAttribute('href')).toBe(
      '/trips/7',
    );
    expect(menu.querySelector('a[aria-label="Edit Berlin to Vienna"]')?.getAttribute('href')).toBe(
      '/trips/7/edit',
    );

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(page.querySelector('.menu-panel')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the actions menu on a click outside', async () => {
    await load([TRIP]);
    menuButton('Berlin to Vienna').click();
    await settle();
    expect(page.querySelector('.menu-panel')).not.toBeNull();

    document.body.click();
    await settle();

    expect(page.querySelector('.menu-panel')).toBeNull();
  });

  it('deletes a trip only after confirmation and removes it from the list', async () => {
    await load([TRIP, SOLO_TRIP]);

    menuButton('Berlin to Vienna').click();
    await settle();
    const menu = page.querySelector('.menu-panel') as HTMLElement;
    buttonByText(menu, 'Delete').click();
    await settle();
    httpTesting.expectNone({ method: 'DELETE' });
    expect(menu.textContent).toContain('Delete this trip?');

    buttonByText(menu, 'Yes, delete').click();
    TestBed.tick();
    httpTesting.expectOne({ method: 'DELETE', url: `${TRIPS_URL}/7` }).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await settle();

    expect(rows().map((row) => row.querySelector('th a')?.textContent)).toEqual(['Solo to Paris']);
  });

  it('keeps the trip and shows an error when deleting fails; cancel asks nothing of the API', async () => {
    await load([TRIP]);

    menuButton('Berlin to Vienna').click();
    await settle();
    const menu = page.querySelector('.menu-panel') as HTMLElement;
    buttonByText(menu, 'Delete').click();
    await settle();
    buttonByText(menu, 'Cancel').click();
    await settle();
    expect(menu.textContent).not.toContain('Delete this trip?');

    buttonByText(menu, 'Delete').click();
    await settle();
    buttonByText(menu, 'Yes, delete').click();
    TestBed.tick();
    httpTesting
      .expectOne({ method: 'DELETE', url: `${TRIPS_URL}/7` })
      .flush(
        { title: 'Not Found', detail: 'Trip with id 7 not found', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Trip with id 7 not found');
    expect(rows()).toHaveLength(1);
  });
});
