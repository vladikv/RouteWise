import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { Trip } from '../../core/api/models';
import { TripListPage } from './trip-list-page';
import { TRIP } from './trip-form.testing';

const TRIPS_URL = 'http://api.test/api/trips';
const SOLO_TRIP: Trip = {
  ...TRIP,
  id: 8,
  title: 'Solo to Paris',
  travelers: 1,
  priority: 'FASTEST',
};

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

  async function load(trips: Trip[]): Promise<void> {
    httpTesting.expectOne(TRIPS_URL).flush(trips);
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

  it('shows a loading state, then the trips with links and labels', async () => {
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading trips');

    await load([TRIP, SOLO_TRIP]);

    const items = page.querySelectorAll('li.trip');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('h2 a')?.textContent).toContain('Berlin to Vienna');
    expect(items[0].querySelector('h2 a')?.getAttribute('href')).toBe('/trips/7');
    expect(items[0].querySelector('.trip__route')?.textContent).toMatch(/Berlin\s+→\s*to\s+Vienna/);
    expect(items[0].querySelector('.trip__meta')?.textContent).toContain('May 20, 2099');
    expect(items[0].querySelector('.trip__meta')?.textContent).toContain('2 travelers');
    expect(items[0].querySelector('.badge')?.textContent).toBe('Greenest');
    expect(items[1].querySelector('.trip__meta')?.textContent).toContain('1 traveler');
    expect(items[0].querySelector('a.button')?.getAttribute('href')).toBe('/trips/7/edit');
    expect(items[0].querySelector('a.button')?.getAttribute('aria-label')).toBe(
      'Edit Berlin to Vienna',
    );
  });

  it('shows an empty state with a call to action', async () => {
    await load([]);

    expect(page.textContent).toContain('No trips yet');
    expect(page.querySelector('.empty a')?.getAttribute('href')).toBe('/trips/new');
  });

  it('shows the load error and retries', async () => {
    httpTesting.expectOne(TRIPS_URL).error(new ProgressEvent('error'));
    await fixture.whenStable();

    buttonByText(page, 'Try again').click();
    TestBed.tick();
    await load([TRIP]);

    expect(page.querySelectorAll('li.trip')).toHaveLength(1);
  });

  it('deletes a trip only after confirmation and removes it from the list', async () => {
    await load([TRIP, SOLO_TRIP]);
    const first = page.querySelector('li.trip') as HTMLElement;

    buttonByText(first, 'Delete').click();
    await fixture.whenStable();
    httpTesting.expectNone({ method: 'DELETE' });
    expect(first.textContent).toContain('Delete this trip?');

    buttonByText(first, 'Yes, delete').click();
    TestBed.tick();
    httpTesting.expectOne({ method: 'DELETE', url: `${TRIPS_URL}/7` }).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await fixture.whenStable();

    const titles = Array.from(page.querySelectorAll('li.trip h2')).map((h) =>
      h.textContent?.trim(),
    );
    expect(titles).toEqual(['Solo to Paris']);
  });

  it('keeps the trip and shows an error when deleting fails; cancel asks nothing of the API', async () => {
    await load([TRIP]);
    const item = page.querySelector('li.trip') as HTMLElement;

    buttonByText(item, 'Delete').click();
    await fixture.whenStable();
    buttonByText(item, 'Cancel').click();
    await fixture.whenStable();
    expect(item.textContent).not.toContain('Delete this trip?');

    buttonByText(item, 'Delete').click();
    await fixture.whenStable();
    buttonByText(item, 'Yes, delete').click();
    TestBed.tick();
    httpTesting
      .expectOne({ method: 'DELETE', url: `${TRIPS_URL}/7` })
      .flush(
        { title: 'Not Found', detail: 'Trip with id 7 not found', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Trip with id 7 not found');
    expect(page.querySelectorAll('li.trip')).toHaveLength(1);
  });
});
