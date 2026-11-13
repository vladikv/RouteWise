import { HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { Trip, TripPage, TripStats } from '../../core/api/models';
import { ToastService } from '../../shared/ui/toast';
import { TripListPage } from './trip-list-page';
import { TRIP } from './trip-form.testing';
import { SOLO_TRIP, listItem, pageOf, statsOf } from './trip-list.testing';

const TRIPS_URL = 'http://api.test/api/trips';
const STATS_URL = `${TRIPS_URL}/stats`;
/** A little more than the page's search debounce. */
const DEBOUNCE_WAIT_MS = 350;

const isSearch = (request: HttpRequest<unknown>): boolean =>
  request.method === 'GET' && request.url === TRIPS_URL;

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

  function expectSearch(): TestRequest {
    return httpTesting.expectOne(isSearch);
  }

  /** Flushes the first list and stats requests. */
  async function load(
    trips: Trip[],
    overrides: { page?: Partial<TripPage>; stats?: Partial<TripStats> } = {},
  ): Promise<void> {
    expectSearch().flush(pageOf(trips, overrides.page));
    httpTesting.expectOne(STATS_URL).flush(statsOf(trips, overrides.stats));
    await settle();
  }

  /** Answers the list request a changed query sends; returns the params that were sent. */
  async function answerSearch(trips: Trip[], overrides: Partial<TripPage> = {}) {
    TestBed.tick();
    const request = expectSearch();
    request.flush(pageOf(trips, overrides));
    await settle();
    return request.request.params;
  }

  /** Answers whatever list requests a view switch sends (it may re-send the same query). */
  async function switchView(
    label: string,
    trips: Trip[],
    overrides: Partial<TripPage> = {},
  ): Promise<void> {
    radio(label).click();
    TestBed.tick();
    await Promise.resolve();
    httpTesting.match(isSearch).forEach((request) => request.flush(pageOf(trips, overrides)));
    await settle();
  }

  /** Answers the list and stats requests that follow a change (delete, restore, move). */
  async function answerReload(trips: Trip[]): Promise<void> {
    TestBed.tick();
    expectSearch().flush(pageOf(trips));
    httpTesting.expectOne(STATS_URL).flush(statsOf(trips));
    await settle();
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

  /** Types into the search box without waiting for the debounce. */
  function type(text: string): void {
    const input = page.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    TestBed.tick();
  }

  async function waitForDebounce(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_WAIT_MS));
    TestBed.tick();
  }

  function rows(): HTMLElement[] {
    return Array.from(page.querySelectorAll<HTMLElement>('tbody tr'));
  }

  function rowTitles(): (string | null | undefined)[] {
    return rows().map((row) => row.querySelector('th a')?.textContent);
  }

  function kpiValues(): string[] {
    return Array.from(page.querySelectorAll('app-stat-chip')).map((element) =>
      (element.querySelector('.value')?.textContent ?? '').trim(),
    );
  }

  function menuButton(title: string): HTMLButtonElement {
    return page.querySelector<HTMLButtonElement>(`button[aria-label="Actions for ${title}"]`)!;
  }

  function summary(): string | undefined {
    return page.querySelector('app-trip-toolbar [role="status"]')?.textContent?.trim();
  }

  function radio(label: string): HTMLButtonElement {
    return Array.from(page.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((button) =>
      button.textContent?.includes(label),
    )!;
  }

  it('asks the API for the first 100 trips by date and for the stats, once each', async () => {
    const request = expectSearch();
    expect(request.request.params.get('sort')).toBe('date');
    expect(request.request.params.get('direction')).toBe('asc');
    expect(request.request.params.get('size')).toBe('100');
    expect(request.request.params.has('q')).toBe(false);
    expect(request.request.params.has('priority')).toBe(false);
    expect(request.request.params.has('mode')).toBe(false);
    request.flush(pageOf([TRIP]));
    httpTesting.expectOne(STATS_URL).flush(statsOf([TRIP]));
    await settle();
  });

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

  it('shows a trip without an available route as such', async () => {
    expectSearch().flush({ ...pageOf([TRIP]), items: [listItem(TRIP, null)] });
    httpTesting.expectOne(STATS_URL).flush(statsOf([TRIP]));
    await settle();

    expect(rows()[0].textContent).toContain('No available route');
  });

  it('shows the KPIs from the stats and a note about left-out trips', async () => {
    expectSearch().flush(pageOf([TRIP, SOLO_TRIP]));
    TestBed.tick();
    await Promise.resolve();
    fixture.detectChanges();

    expect(page.querySelector('app-stat-chip')).toBeNull();
    expect(rows()).toHaveLength(2);

    httpTesting.expectOne(STATS_URL).flush(statsOf([TRIP, SOLO_TRIP]));
    await settle();

    expect(kpiValues()).toEqual(['2', '72 kg', '€104']);
    expect(page.textContent).toContain('Trips planned');
    expect(page.textContent).toContain('CO₂ saved vs car');
    expect(page.textContent).toContain('Average cost per trip');
    expect(page.querySelector('.kpis__note')?.textContent).toContain('Based on 1 of 2 trips');
  });

  it('shows dashes for the CO2 and cost KPIs when no trip has figures and no note when none is left out', async () => {
    await load([TRIP], {
      stats: { co2TripsCounted: 0, co2SavedVsCarKg: 0, averageCost: null, tripsLeftOut: 0 },
    });

    expect(kpiValues()).toEqual(['1', '–', '–']);
    expect(page.querySelector('.kpis__note')).toBeNull();
  });

  it('shows an empty state with a call to action', async () => {
    await load([]);

    expect(page.textContent).toContain('No trips yet');
    expect(page.textContent).not.toContain('No trips match your filters');
    expect(page.querySelector('.empty-state a')?.getAttribute('href')).toBe('/trips/new');
    expect(page.querySelector('app-stat-chip')).toBeNull();
    expect(page.querySelector('input[type="search"]')).toBeNull();
  });

  it('shows the load error and retries', async () => {
    expectSearch().error(new ProgressEvent('error'));
    httpTesting.expectOne(STATS_URL).flush(statsOf([TRIP]));
    await settle();

    expect(page.querySelector('[role="alert"]')).not.toBeNull();
    buttonByText(page, 'Try again').click();
    TestBed.tick();
    expectSearch().flush(pageOf([TRIP]));
    await settle();

    expect(rows()).toHaveLength(1);
    expect(page.querySelector('[role="alert"]')).toBeNull();
  });

  it('sends the search text to the API after the debounce, with the other filters', async () => {
    await load([TRIP, SOLO_TRIP]);
    chip('Fastest').click();
    await answerSearch([SOLO_TRIP]);

    type('PARIS');
    await waitForDebounce();
    const params = await answerSearch([SOLO_TRIP]);

    expect(params.get('q')).toBe('PARIS');
    expect(params.getAll('priority')).toEqual(['FASTEST']);
    expect(rowTitles()).toEqual(['Solo to Paris']);
  });

  it('sends one request for a burst of typing, after the pause', async () => {
    await load([TRIP, SOLO_TRIP]);

    type('p');
    type('pa');
    type('par');
    httpTesting.expectNone(isSearch);
    await waitForDebounce();
    const params = await answerSearch([SOLO_TRIP]);

    expect(params.get('q')).toBe('par');
    expect(rowTitles()).toEqual(['Solo to Paris']);
  });

  it('trims the search text and sends nothing for a blank search', async () => {
    await load([TRIP, SOLO_TRIP]);

    type('  vienna ');
    await waitForDebounce();
    expect((await answerSearch([TRIP])).get('q')).toBe('vienna');

    type('   ');
    await waitForDebounce();
    TestBed.tick();
    const blank = expectSearch();
    expect(blank.request.params.has('q')).toBe(false);
    blank.flush(pageOf([TRIP, SOLO_TRIP]));
    await settle();
  });

  it('sends the selected priorities and modes as repeated params and shows pressed chips', async () => {
    await load([TRIP, SOLO_TRIP]);

    chip('Fastest').click();
    const first = await answerSearch([SOLO_TRIP]);
    expect(first.getAll('priority')).toEqual(['FASTEST']);
    expect(chip('Fastest').getAttribute('aria-pressed')).toBe('true');
    expect(rows()).toHaveLength(1);

    chip('Greenest').click();
    const second = await answerSearch([TRIP, SOLO_TRIP]);
    expect(second.getAll('priority')).toEqual(['FASTEST', 'GREENEST']);

    chip('Bus').click();
    chip('Train').click();
    const third = await answerSearch([SOLO_TRIP]);
    expect(third.getAll('mode')).toEqual(['BUS', 'TRAIN']);

    chip('Fastest').click();
    chip('Greenest').click();
    const fourth = await answerSearch([SOLO_TRIP]);
    expect(fourth.has('priority')).toBe(false);
    expect(chip('Fastest').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps showing the previous trips while a new page loads', async () => {
    await load([TRIP, SOLO_TRIP]);

    chip('Fastest').click();
    TestBed.tick();
    await Promise.resolve();
    fixture.detectChanges();
    const pending = expectSearch();

    expect(rows()).toHaveLength(2);
    expect(page.querySelector('app-spinner')).toBeNull();

    pending.flush(pageOf([SOLO_TRIP]));
    await settle();
    expect(rows()).toHaveLength(1);
  });

  it('shows a no-matches state and clears the filters', async () => {
    await load([TRIP, SOLO_TRIP]);
    chip('Cheapest').click();
    await answerSearch([]);

    expect(page.textContent).toContain('No trips match your filters');
    expect(page.textContent).not.toContain('No trips yet');
    expect(rows()).toHaveLength(0);
    expect(summary()).toBe('0 of 2 trips');

    buttonByText(page, 'Clear filters').click();
    const params = await answerSearch([TRIP, SOLO_TRIP]);

    expect(params.has('priority')).toBe(false);
    expect(rows()).toHaveLength(2);
    expect(chip('Cheapest').getAttribute('aria-pressed')).toBe('false');
  });

  it('clears a search after the debounce and shows all trips again', async () => {
    await load([TRIP, SOLO_TRIP]);
    type('nowhere');
    await waitForDebounce();
    await answerSearch([]);
    expect(page.textContent).toContain('No trips match your filters');

    buttonByText(page, 'Clear filters').click();
    await waitForDebounce();
    const sent = httpTesting.match(isSearch).filter((request) => !request.cancelled);
    expect(sent).toHaveLength(1);
    sent[0].flush(pageOf([TRIP, SOLO_TRIP]));
    await settle();
    const params = sent[0].request.params;

    expect(params.has('q')).toBe(false);
    expect(page.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('');
    expect(rows()).toHaveLength(2);
  });

  it('shows "N of M trips" with M from the stats, and Clear filters only while filtering', async () => {
    await load([TRIP, SOLO_TRIP]);
    expect(summary()).toBe('2 of 2 trips');
    expect(buttonOrNull('Clear filters')).toBeNull();

    chip('Fastest').click();
    await answerSearch([SOLO_TRIP]);

    expect(summary()).toBe('1 of 2 trips');
    expect(buttonOrNull('Clear filters')).not.toBeNull();

    buttonByText(page, 'Clear filters').click();
    await answerSearch([TRIP, SOLO_TRIP]);

    expect(summary()).toBe('2 of 2 trips');
    expect(buttonOrNull('Clear filters')).toBeNull();
  });

  it('takes the chip counts from the API facets, not from the trips shown', async () => {
    await load([TRIP, SOLO_TRIP], {
      page: {
        facets: {
          priorities: [
            { priority: 'FASTEST', count: 5 },
            { priority: 'CHEAPEST', count: 0 },
            { priority: 'GREENEST', count: 1 },
            { priority: 'BALANCED', count: 1 },
          ],
          modes: [
            { mode: 'TRAIN', count: 6 },
            { mode: 'BUS', count: 1 },
            { mode: 'CAR', count: 0 },
            { mode: 'BIKE', count: 0 },
            { mode: 'PLANE', count: 0 },
          ],
        },
      },
    });

    expect(chip('Fastest').getAttribute('aria-label')).toBe('Fastest, 5 trips');
    expect(chip('Cheapest').getAttribute('aria-label')).toBe('Cheapest, 0 trips');
    expect(chip('Greenest').getAttribute('aria-label')).toBe('Greenest, 1 trip');
    expect(chip('Train').getAttribute('aria-label')).toBe('Train, 6 trips');
    expect(chip('Bus').getAttribute('aria-label')).toBe('Bus, 1 trip');
    expect(chip('Plane').getAttribute('aria-label')).toBe('Plane, 0 trips');
  });

  it('switches between the board and the list', async () => {
    await load([TRIP, SOLO_TRIP]);

    expect(page.querySelector('app-trip-board')).toBeNull();

    await switchView('Board', [TRIP, SOLO_TRIP]);

    const board = page.querySelector('app-trip-board')!;
    expect(page.querySelector('table')).toBeNull();
    expect(board.querySelector('[role="region"]')?.getAttribute('tabindex')).toBe('0');
    const headings = Array.from(board.querySelectorAll('h2')).map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings).toEqual([
      'Fastest 1 trip',
      'Cheapest 0 trips',
      'Greenest 1 trip',
      'Balanced 0 trips',
    ]);
    expect(board.textContent).toContain('€151 total');
    expect(board.querySelectorAll('app-trip-card')).toHaveLength(2);
    expect(board.textContent).toContain('No trips');

    chip('Greenest').click();
    await answerSearch([TRIP]);
    expect(board.querySelectorAll('h2')).toHaveLength(1);

    await switchView('List', [TRIP]);
    expect(page.querySelector('app-trip-board')).toBeNull();
    expect(page.querySelector('table')).not.toBeNull();
  });

  it('takes the board column counts and totals from the API when trips are beyond the page', async () => {
    await load([TRIP, SOLO_TRIP], {
      page: {
        totalItems: 52,
        priorityTotals: [
          { priority: 'FASTEST', count: 40, totalCost: 2300 },
          { priority: 'CHEAPEST', count: 0, totalCost: 0 },
          { priority: 'GREENEST', count: 12, totalCost: 1800 },
          { priority: 'BALANCED', count: 0, totalCost: 0 },
        ],
      },
    });
    await switchView('Board', [TRIP, SOLO_TRIP], {
      totalItems: 52,
      priorityTotals: [
        { priority: 'FASTEST', count: 40, totalCost: 2300 },
        { priority: 'CHEAPEST', count: 0, totalCost: 0 },
        { priority: 'GREENEST', count: 12, totalCost: 1800 },
        { priority: 'BALANCED', count: 0, totalCost: 0 },
      ],
    });

    const board = page.querySelector('app-trip-board')!;
    const headings = Array.from(board.querySelectorAll('h2')).map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings[0]).toBe('Fastest 40 trips');
    expect(headings[2]).toBe('Greenest 12 trips');
    expect(board.textContent).toContain('€1,800 total');
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

  function sortButton(label: string): HTMLButtonElement {
    const button = Array.from(page.querySelectorAll<HTMLButtonElement>('thead th button')).find(
      (candidate) => candidate.textContent?.trim().startsWith(label),
    );
    if (!button) {
      throw new Error(`No sort button "${label}"`);
    }
    return button;
  }

  function ariaSort(label: string): string | null {
    return sortButton(label).closest('th')!.getAttribute('aria-sort');
  }

  it('lists the trips in the order the API returns and marks the date sort', async () => {
    const later: Trip = { ...TRIP, id: 9, title: 'Later', departureDate: '2099-07-01' };
    await load([SOLO_TRIP, TRIP, later]);

    expect(rowTitles()).toEqual(['Solo to Paris', 'Berlin to Vienna', 'Later']);
    expect(ariaSort('Date')).toBe('ascending');
    expect(ariaSort('Cost')).toBe('none');
    expect(ariaSort('CO₂')).toBe('none');
  });

  it('asks the API for the sort a column click selects and shows the answer in its order', async () => {
    await load([TRIP, SOLO_TRIP]);

    sortButton('Cost').click();
    const byCost = await answerSearch([SOLO_TRIP, TRIP]);
    expect(byCost.get('sort')).toBe('cost');
    expect(byCost.get('direction')).toBe('asc');
    expect(ariaSort('Cost')).toBe('ascending');
    expect(ariaSort('Date')).toBe('none');
    expect(rowTitles()).toEqual(['Solo to Paris', 'Berlin to Vienna']);

    sortButton('Cost').click();
    const descending = await answerSearch([TRIP, SOLO_TRIP]);
    expect(descending.get('sort')).toBe('cost');
    expect(descending.get('direction')).toBe('desc');
    expect(ariaSort('Cost')).toBe('descending');
    expect(rowTitles()).toEqual(['Berlin to Vienna', 'Solo to Paris']);

    sortButton('CO₂').click();
    const byCo2 = await answerSearch([SOLO_TRIP, TRIP]);
    expect(byCo2.get('sort')).toBe('co2');
    expect(byCo2.get('direction')).toBe('asc');
    expect(ariaSort('CO₂')).toBe('ascending');
  });

  it('keeps the board in date order even when the list is sorted by cost', async () => {
    await load([TRIP, SOLO_TRIP]);
    sortButton('Cost').click();
    await answerSearch([SOLO_TRIP, TRIP]);

    radio('Board').click();
    const params = await answerSearch([TRIP, SOLO_TRIP]);

    expect(params.get('sort')).toBe('date');
    expect(params.get('direction')).toBe('asc');
  });

  it('opens the trip from the whole row: the title link covers it', async () => {
    await load([TRIP]);

    expect(rows()[0].classList.contains('row')).toBe(true);
    expect(rows()[0].querySelectorAll('th a')).toHaveLength(1);
  });

  it('hands the trip to the New trip form through navigation state when duplicating', async () => {
    await load([TRIP]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    rows()[0]
      .querySelector<HTMLAnchorElement>('app-trip-actions a[aria-label^="Duplicate"]')!
      .click();

    const [url, extras] = navigate.mock.calls[0];
    expect(String(url)).toBe('/trips/new');
    expect(extras?.state).toEqual({
      draft: {
        title: 'Berlin to Vienna (copy)',
        stops: [3, 23],
        departureDate: '2099-05-20',
        travelers: 2,
        priority: 'GREENEST',
        notes: 'Window seat',
      },
    });
  });

  it('offers Duplicate in the menu next to Open and Edit', async () => {
    await load([TRIP]);

    menuButton('Berlin to Vienna').click();
    await settle();
    const menu = page.querySelector('.menu-panel') as HTMLElement;

    expect(
      Array.from(menu.querySelectorAll('a, button')).map((item) => item.textContent?.trim()),
    ).toEqual([
      'Open',
      'Edit',
      'Duplicate',
      'Move to Fastest',
      'Move to Cheapest',
      'Move to Balanced',
      'Delete',
    ]);
  });

  describe('deleting', () => {
    let toasts: ToastService;

    beforeEach(() => {
      toasts = TestBed.inject(ToastService);
    });

    afterEach(() => toasts.toasts().forEach((toast) => toasts.dismiss(toast.id)));

    async function confirmDelete(): Promise<void> {
      const quick = rows()[0].querySelector('app-trip-actions') as HTMLElement;
      quick.querySelector<HTMLButtonElement>('button[aria-label^="Delete"]')!.click();
      await settle();
      httpTesting.expectNone({ method: 'DELETE' });
      expect(quick.textContent).toContain('Delete this trip?');

      buttonByText(quick, 'Yes, delete').click();
      TestBed.tick();
    }

    /** Answers the DELETE; the page then reloads, so the reload requests stay open. */
    async function flushDelete(): Promise<void> {
      httpTesting.expectOne({ method: 'DELETE', url: `${TRIPS_URL}/7` }).flush(null, {
        status: 204,
        statusText: 'No Content',
      });
      TestBed.tick();
      await Promise.resolve();
      fixture.detectChanges();
    }

    it('deletes only after confirmation, removes the trip and reloads the list and stats', async () => {
      await load([TRIP, SOLO_TRIP]);

      await confirmDelete();
      await flushDelete();
      expect(rowTitles()).toEqual(['Solo to Paris']);

      await answerReload([SOLO_TRIP]);

      expect(rowTitles()).toEqual(['Solo to Paris']);
      expect(summary()).toBe('1 of 1 trip');
      expect(kpiValues()[0]).toBe('1');
    });

    it('deletes from the actions menu after confirmation too', async () => {
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
      await flushDelete();
      await answerReload([SOLO_TRIP]);

      expect(rowTitles()).toEqual(['Solo to Paris']);
    });

    it('shows an info toast with Undo after a delete', async () => {
      await load([TRIP, SOLO_TRIP]);
      await confirmDelete();
      await flushDelete();
      await answerReload([SOLO_TRIP]);

      const [toast] = toasts.toasts();
      expect(toast.kind).toBe('info');
      expect(toast.message).toBe('Deleted "Berlin to Vienna"');
      expect(toast.action?.label).toBe('Undo');
    });

    it('restores the trip on Undo and reloads the list and stats', async () => {
      await load([TRIP, SOLO_TRIP]);
      await confirmDelete();
      await flushDelete();
      await answerReload([SOLO_TRIP]);

      toasts.toasts()[0].action?.run();
      const restore = httpTesting.expectOne({ method: 'POST', url: `${TRIPS_URL}/7/restore` });
      restore.flush(TRIP);
      TestBed.tick();
      await Promise.resolve();
      await answerReload([TRIP, SOLO_TRIP]);

      expect(rowTitles()).toEqual(['Berlin to Vienna', 'Solo to Paris']);
      expect(summary()).toBe('2 of 2 trips');
      expect(page.querySelector('p[role="status"].visually-hidden')?.textContent).toBe(
        'Restored "Berlin to Vienna"',
      );
    });

    it('reports a failed restore in an error toast', async () => {
      await load([TRIP, SOLO_TRIP]);
      await confirmDelete();
      await flushDelete();
      await answerReload([SOLO_TRIP]);

      toasts.toasts()[0].action?.run();
      httpTesting
        .expectOne({ method: 'POST', url: `${TRIPS_URL}/7/restore` })
        .flush(
          { title: 'Conflict', detail: 'The restore window has passed.', status: 409 },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();

      const error = toasts.toasts().find((toast) => toast.kind === 'error');
      expect(error?.message).toBe(
        'Couldn\'t restore "Berlin to Vienna". The restore window has passed.',
      );
      expect(rowTitles()).toEqual(['Solo to Paris']);
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

      expect(page.querySelector('[role="alert"]')?.textContent).toContain(
        'Trip with id 7 not found',
      );
      expect(rows()).toHaveLength(1);
      expect(toasts.toasts()).toHaveLength(0);
    });
  });
});
