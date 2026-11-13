import { HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api-config';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { Trip, TripPage } from '../../core/api/models';
import { installDialogSupport } from '../../shared/ui/dialog.testing';
import { ToastService } from '../../shared/ui/toast';
import { COMPARISON } from './comparison/comparison.testing';
import { TRIP } from './trip-form.testing';
import { TripListPage } from './trip-list-page';
import { SOLO_TRIP, pageOf, statsOf } from './trip-list.testing';

const TRIPS_URL = 'http://api.test/api/trips';
const STATS_URL = `${TRIPS_URL}/stats`;
const isSearch = (request: HttpRequest<unknown>): boolean =>
  request.method === 'GET' && request.url === TRIPS_URL;

/** Three pages of twenty, of which the test supplies the trips on the current one. */
const PAGED: Partial<TripPage> = { size: 20, totalItems: 45, totalPages: 3 };

/** The interactive List view: expanding rows, paging and the inline priority. */
describe('TripListPage list view', () => {
  let fixture: ComponentFixture<TripListPage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;
  let toasts: ToastService;

  beforeEach(async () => {
    installDialogSupport();
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
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(TripListPage);
    page = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
    toasts.toasts().forEach((toast) => toasts.dismiss(toast.id));
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  async function load(trips: Trip[], overrides: Partial<TripPage> = {}): Promise<void> {
    httpTesting.expectOne(isSearch).flush(pageOf(trips, overrides));
    httpTesting.expectOne(STATS_URL).flush(statsOf(trips));
    await settle();
  }

  /** Answers the list request a changed query sends and returns its params. */
  async function answerSearch(trips: Trip[], overrides: Partial<TripPage> = {}) {
    TestBed.tick();
    const request = httpTesting.expectOne(isSearch);
    request.flush(pageOf(trips, overrides));
    await settle();
    return request.request.params;
  }

  const rows = () => Array.from(page.querySelectorAll<HTMLElement>('tbody tr.row'));
  const rowTitles = () => rows().map((row) => row.querySelector('th a')?.textContent?.trim());
  const detail = () => page.querySelector<HTMLElement>('tr.detail');
  const button = (text: string) =>
    Array.from(page.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;

  describe('expanding a row', () => {
    const COMPARISON_URL = `${TRIPS_URL}/7/comparison`;

    async function expandFirst(): Promise<void> {
      rows()[0].querySelector<HTMLElement>('td.trip__date')!.click();
      TestBed.tick();
      await Promise.resolve();
      fixture.detectChanges();
    }

    it('asks for no comparison until a row is expanded', async () => {
      await load([TRIP, SOLO_TRIP]);

      expect(detail()).toBeNull();
      httpTesting.expectNone(COMPARISON_URL);
    });

    it('loads the trip comparison on the first expand, shows its legs and weather, and offers the row actions', async () => {
      await load([TRIP, SOLO_TRIP]);

      await expandFirst();
      expect(detail()?.querySelector('[role="status"]')?.textContent).toContain('Loading');
      httpTesting.expectOne({ method: 'GET', url: COMPARISON_URL }).flush(COMPARISON);
      await settle();

      const open = detail()!;
      expect(rows()[0].querySelector('.toggle')?.getAttribute('aria-expanded')).toBe('true');
      expect(open.querySelectorAll('.leg')).toHaveLength(1);
      expect(open.textContent).toContain('Berlin');
      expect(open.textContent).toContain('Vienna');
      expect(open.textContent).toContain('Train');
      expect(open.textContent).toContain('6 h 13 min');
      expect(open.textContent).toContain('€151');
      expect(open.textContent).toContain('44 kg');
      expect(open.textContent).toContain('Vienna: Rain');
      expect(open.querySelector('a[href="/trips/7"]')?.textContent).toContain('Open on map');
      expect(open.querySelector('a[href="/trips/7/edit"]')?.textContent).toContain('Edit');
      expect(open.textContent).toContain('Delete');
    });

    it('requests the comparison only once: collapsing and expanding again reuses it', async () => {
      await load([TRIP, SOLO_TRIP]);
      await expandFirst();
      httpTesting.expectOne({ method: 'GET', url: COMPARISON_URL }).flush(COMPARISON);
      await settle();

      await expandFirst();
      expect(detail()).toBeNull();
      await expandFirst();

      expect(detail()?.textContent).toContain('6 h 13 min');
      httpTesting.expectNone(COMPARISON_URL);
    });

    it('shows an error with a retry inside the row when the comparison fails', async () => {
      await load([TRIP, SOLO_TRIP]);
      await expandFirst();
      httpTesting
        .expectOne({ method: 'GET', url: COMPARISON_URL })
        .flush(
          { title: 'Server error', detail: 'Weather lookup failed', status: 500 },
          { status: 500, statusText: 'Server Error' },
        );
      await settle();

      expect(detail()?.querySelector('[role="alert"]')?.textContent).toContain(
        'Weather lookup failed',
      );
      expect(detail()?.textContent).toContain('Open on map');

      detail()!.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
      TestBed.tick();
      httpTesting.expectOne({ method: 'GET', url: COMPARISON_URL }).flush(COMPARISON);
      await settle();

      expect(detail()?.querySelector('[role="alert"]')).toBeNull();
      expect(detail()?.textContent).toContain('6 h 13 min');
    });

    it('cancels a comparison request that a newer one replaces, so an old answer cannot overwrite it', async () => {
      await load([TRIP, SOLO_TRIP]);
      await expandFirst();
      const stale = httpTesting.expectOne({ method: 'GET', url: COMPARISON_URL });

      const select = rows()[0].querySelector<HTMLSelectElement>('select')!;
      select.value = 'CHEAPEST';
      select.dispatchEvent(new Event('change'));
      TestBed.tick();
      await Promise.resolve();
      const saved = { ...TRIP, priority: 'CHEAPEST' } as Trip;
      httpTesting.expectOne({ method: 'PUT', url: `${TRIPS_URL}/7` }).flush(saved);
      TestBed.tick();
      await Promise.resolve();
      httpTesting.expectOne(isSearch).flush(pageOf([saved, SOLO_TRIP]));
      httpTesting.expectOne(STATS_URL).flush(statsOf([saved, SOLO_TRIP]));
      const fresh = httpTesting.expectOne({ method: 'GET', url: COMPARISON_URL });
      fresh.flush(COMPARISON);
      await settle();

      expect(stale.cancelled).toBe(true);
      expect(detail()?.textContent).toContain('6 h 13 min');
    });

    it('deletes from the expanded row through the confirm dialog', async () => {
      await load([TRIP, SOLO_TRIP]);
      await expandFirst();
      httpTesting.expectOne({ method: 'GET', url: COMPARISON_URL }).flush(COMPARISON);
      await settle();

      Array.from(detail()!.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Delete'))!
        .click();
      await settle();
      const dialog = page.querySelector('dialog')!;
      expect(dialog.hasAttribute('open')).toBe(true);
      httpTesting.expectNone({ method: 'DELETE' });

      Array.from(dialog.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Delete')!
        .click();
      TestBed.tick();
      httpTesting
        .expectOne({ method: 'DELETE', url: `${TRIPS_URL}/7` })
        .flush(null, { status: 204, statusText: 'No Content' });
      TestBed.tick();
      await Promise.resolve();
      fixture.detectChanges();

      expect(detail()).toBeNull();
      expect(rowTitles()).toEqual(['Solo to Paris']);
      TestBed.tick();
      httpTesting.expectOne(isSearch).flush(pageOf([SOLO_TRIP]));
      httpTesting.expectOne(STATS_URL).flush(statsOf([SOLO_TRIP]));
      await settle();
      expect(toasts.toasts()[0].message).toBe('Deleted "Berlin to Vienna"');
    });
  });

  describe('paging', () => {
    it('shows page controls with the range and the total, from the API page', async () => {
      await load([TRIP, SOLO_TRIP], PAGED);

      const nav = page.querySelector('nav[aria-label="Pagination"]')!;
      expect(nav.textContent).toContain('1–2 of 45 trips');
      expect(nav.textContent).toContain('Page 1 of 3');
    });

    it('shows no page controls for a single page', async () => {
      await load([TRIP, SOLO_TRIP]);

      expect(page.querySelector('nav[aria-label="Pagination"]')).toBeNull();
    });

    it('sends the page and keeps the rows of the previous page until the next one arrives', async () => {
      await load([TRIP], PAGED);

      button('Next').click();
      TestBed.tick();
      const request = httpTesting.expectOne(isSearch);
      expect(request.request.params.get('page')).toBe('1');
      expect(request.request.params.get('size')).toBe('20');
      expect(rowTitles()).toEqual(['Berlin to Vienna']);

      request.flush(pageOf([SOLO_TRIP], { ...PAGED, page: 1 }));
      await settle();

      expect(rowTitles()).toEqual(['Solo to Paris']);
      expect(page.querySelector('nav[aria-label="Pagination"]')?.textContent).toContain(
        'Page 2 of 3',
      );
    });

    it('goes back with Previous', async () => {
      await load([TRIP], PAGED);
      button('Next').click();
      await answerSearch([SOLO_TRIP], { ...PAGED, page: 1 });

      button('Previous').click();
      const params = await answerSearch([TRIP], PAGED);

      expect(params.get('page')).toBe('0');
    });

    it('goes back to the first page when a filter, the search or the sort changes', async () => {
      await load([TRIP], PAGED);
      button('Next').click();
      await answerSearch([SOLO_TRIP], { ...PAGED, page: 1 });

      page
        .querySelector<HTMLButtonElement>('app-filter-group button[aria-label^="Fastest"]')!
        .click();
      expect((await answerSearch([SOLO_TRIP], PAGED)).get('page')).toBe('0');

      button('Next').click();
      await answerSearch([TRIP], { ...PAGED, page: 1 });
      button('Cost').click();
      const sorted = await answerSearch([TRIP], PAGED);
      expect(sorted.get('page')).toBe('0');
      expect(sorted.get('sort')).toBe('cost');
    });

    it('steps back a page when the last trip of the last page is deleted', async () => {
      await load([TRIP], { ...PAGED, totalItems: 21, totalPages: 2 });
      button('Next').click();
      await answerSearch([SOLO_TRIP], { ...PAGED, page: 1, totalItems: 21, totalPages: 2 });

      page
        .querySelector<HTMLButtonElement>(
          'tbody tr.row app-trip-actions button[aria-label^="Delete"]',
        )!
        .click();
      await settle();
      Array.from(page.querySelectorAll<HTMLButtonElement>('dialog button'))
        .find((b) => b.textContent?.trim() === 'Delete')!
        .click();
      TestBed.tick();
      httpTesting
        .expectOne({ method: 'DELETE', url: `${TRIPS_URL}/8` })
        .flush(null, { status: 204, statusText: 'No Content' });
      TestBed.tick();
      await Promise.resolve();
      fixture.detectChanges();

      TestBed.tick();
      const request = httpTesting.expectOne(isSearch);
      expect(request.request.params.get('page')).toBe('0');
      request.flush(pageOf([TRIP]));
      httpTesting.expectOne(STATS_URL).flush(statsOf([TRIP]));
      await settle();
      expect(rowTitles()).toEqual(['Berlin to Vienna']);
    });

    it('loads up to 100 trips at once in the board, without page controls', async () => {
      await load([TRIP, SOLO_TRIP], PAGED);

      Array.from(page.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
        .find((radio) => radio.textContent?.includes('Board'))!
        .click();
      TestBed.tick();
      const request = httpTesting.expectOne(isSearch);
      expect(request.request.params.get('size')).toBe('100');
      expect(request.request.params.get('page')).toBe('0');
      request.flush(pageOf([TRIP, SOLO_TRIP]));
      await settle();

      expect(page.querySelector('nav[aria-label="Pagination"]')).toBeNull();
    });
  });

  describe('inline priority', () => {
    const select = () => rows()[0].querySelector<HTMLSelectElement>('select')!;

    function choose(priority: string): void {
      select().value = priority;
      select().dispatchEvent(new Event('change'));
      TestBed.tick();
    }

    it('shows the new priority at once, saves it with the trip and reloads the list and stats', async () => {
      await load([TRIP, SOLO_TRIP]);
      expect(select().value).toBe('GREENEST');

      choose('CHEAPEST');
      await Promise.resolve();
      fixture.detectChanges();
      const update = httpTesting.expectOne({ method: 'PUT', url: `${TRIPS_URL}/7` });
      expect(update.request.body.priority).toBe('CHEAPEST');
      expect(select().value).toBe('CHEAPEST');
      expect(rows()[0].getAttribute('aria-busy')).toBe('true');

      update.flush({ ...TRIP, priority: 'CHEAPEST' });
      TestBed.tick();
      await Promise.resolve();
      const saved = { ...TRIP, priority: 'CHEAPEST' } as Trip;
      httpTesting.expectOne(isSearch).flush(pageOf([saved, SOLO_TRIP]));
      httpTesting.expectOne(STATS_URL).flush(statsOf([saved, SOLO_TRIP]));
      await settle();

      expect(select().value).toBe('CHEAPEST');
      expect(rows()[0].hasAttribute('aria-busy')).toBe(false);
      expect(toasts.toasts()).toHaveLength(0);
    });

    it('rolls the select back and shows an error toast when saving fails', async () => {
      await load([TRIP, SOLO_TRIP]);

      choose('FASTEST');
      await Promise.resolve();
      fixture.detectChanges();
      expect(select().value).toBe('FASTEST');
      httpTesting
        .expectOne({ method: 'PUT', url: `${TRIPS_URL}/7` })
        .flush(
          { title: 'Server error', detail: 'Could not save', status: 500 },
          { status: 500, statusText: 'Server Error' },
        );
      await settle();

      expect(select().value).toBe('GREENEST');
      expect(toasts.toasts()).toHaveLength(1);
      expect(toasts.toasts()[0].kind).toBe('error');
      expect(toasts.toasts()[0].message).toContain('Could not save');
      expect(toasts.toasts()[0].action?.label).toBe('Retry');
    });
  });
});
