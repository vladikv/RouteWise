import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../../core/api/api-config';
import { apiErrorInterceptor } from '../../../core/api/api-error';
import { HttpRequest } from '@angular/common/http';
import { Trip, TripPage } from '../../../core/api/models';
import { ToastService } from '../../../shared/ui/toast';
import { TripListPage } from '../trip-list-page';
import { TRIP } from '../trip-form.testing';
import { SOLO_TRIP, pageOf, statsOf } from '../trip-list.testing';

const TRIPS_URL = 'http://api.test/api/trips';
const LATER: Trip = { ...SOLO_TRIP, id: 9, title: 'Later', priority: 'FASTEST' };
const STATS_URL = `${TRIPS_URL}/stats`;
const isSearch = (request: HttpRequest<unknown>): boolean =>
  request.method === 'GET' && request.url === TRIPS_URL;

function saved(trip: Trip, priority: Trip['priority']): Trip {
  return { ...trip, priority, updatedAt: '2026-11-12T08:00:00Z' };
}

/** Changing a trip's priority on the Trips page: from the menu and by dragging on the board. */
describe('TripListPage priority change', () => {
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

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  /** Lets the timer that removes the click guard after a drag run. */
  async function afterClick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
  }

  let current: Trip[] = [];

  /**
   * The page as the API sends it. Every column count is at least 1 here, so the tests follow a card
   * while its move is pending without depending on how the board counts.
   */
  function pageFor(trips: Trip[]): TripPage {
    const page = pageOf(trips);
    return {
      ...page,
      priorityTotals: page.priorityTotals.map((total) => ({
        ...total,
        count: Math.max(total.count, 1),
      })),
    };
  }

  async function load(trips: Trip[]): Promise<void> {
    current = trips;
    httpTesting.expectOne(isSearch).flush(pageFor(trips));
    httpTesting.expectOne(STATS_URL).flush(statsOf(trips));
    await settle();
  }

  /** The list and stats the page reloads after a saved move; the trips are as the API now has them. */
  async function reloaded(trips: Trip[]): Promise<void> {
    TestBed.tick();
    httpTesting.expectOne(isSearch).flush(pageOf(trips));
    httpTesting.expectOne(STATS_URL).flush(statsOf(trips));
    await settle();
  }

  async function showBoard(): Promise<void> {
    const radio = Array.from(page.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (button) => button.textContent?.includes('Board'),
    );
    radio?.click();
    TestBed.tick();
    await Promise.resolve();
    httpTesting.match(isSearch).forEach((request) => request.flush(pageFor(current)));
    await settle();
  }

  function column(priority: string): HTMLElement {
    return page.querySelector<HTMLElement>(`[data-priority="${priority}"]`)!;
  }

  function titlesIn(priority: string): (string | null | undefined)[] {
    return Array.from(column(priority).querySelectorAll('.trip__title a')).map(
      (link) => link.textContent,
    );
  }

  function slot(title: string): HTMLElement {
    return Array.from(page.querySelectorAll<HTMLElement>('.slot')).find((item) =>
      item.textContent?.includes(title),
    )!;
  }

  function titleLink(title: string): HTMLAnchorElement {
    return slot(title).querySelector<HTMLAnchorElement>('.trip__title a')!;
  }

  function menuButton(title: string): HTMLButtonElement {
    return page.querySelector<HTMLButtonElement>(`button[aria-label="Actions for ${title}"]`)!;
  }

  /** Four 100 px wide columns with gaps: Fastest 0-100, Cheapest 200-300, Greenest 400-500. */
  function layOutColumns(): void {
    page.querySelectorAll<HTMLElement>('[data-priority]').forEach((element, index) => {
      const left = index * 200;
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        left,
        right: left + 100,
        top: 0,
        bottom: 500,
        width: 100,
        height: 500,
        x: left,
        y: 0,
        toJSON: () => ({}),
      });
    });
  }

  function pointer(target: EventTarget, type: string, x: number, y: number, extra = {}): void {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        isPrimary: true,
        pointerType: 'mouse',
        button: 0,
        ...extra,
      }),
    );
  }

  function ghost(): Element | null {
    return document.body.querySelector(':scope > li[aria-hidden="true"]');
  }

  function expectPut(priority: string) {
    const request = httpTesting.expectOne({ method: 'PUT', url: `${TRIPS_URL}/7` });
    expect(request.request.body).toEqual({
      title: 'Berlin to Vienna',
      stops: [{ cityId: 3 }, { cityId: 23 }],
      departureDate: '2099-05-20',
      travelers: 2,
      priority,
      notes: 'Window seat',
    });
    return request;
  }

  /** Presses the Berlin card (Greenest column) and drags to `x`. */
  function dragBerlinTo(x: number): void {
    layOutColumns();
    pointer(titleLink('Berlin to Vienna'), 'pointerdown', 450, 50);
    pointer(document, 'pointermove', x, 60);
  }

  function afterMove(trip: Trip, priority: Trip['priority']): Trip[] {
    return current.map((item) => (item.id === trip.id ? saved(item, priority) : item));
  }

  async function finishMove(trip: Trip, priority: Trip['priority']): Promise<void> {
    TestBed.tick();
    expectPut(priority).flush(saved(trip, priority));
    await reloaded(afterMove(trip, priority));
  }

  it('moves a trip from the menu: optimistic, then replaced by the response', async () => {
    await load([TRIP, SOLO_TRIP]);
    menuButton('Berlin to Vienna').click();
    await settle();
    const items = Array.from(page.querySelectorAll('.menu-panel button'));
    expect(items.map((item) => item.textContent?.trim())).toContain('Move to Cheapest');
    expect(items.map((item) => item.textContent?.trim())).not.toContain('Move to Greenest');

    (items.find((item) => item.textContent?.includes('Move to Cheapest')) as HTMLElement).click();
    TestBed.tick();
    const put = expectPut('CHEAPEST');
    await settle();
    expect(document.activeElement).toBe(page.querySelector('tbody tr th a'));

    const row = page.querySelector('tbody tr')!;
    expect(row.textContent).toContain('Cheapest');
    expect(row.getAttribute('aria-busy')).toBe('true');
    expect(page.querySelector('.menu-panel')).toBeNull();
    expect(page.querySelector('p[role="status"].visually-hidden')?.textContent).toBe(
      'Moved "Berlin to Vienna" to Cheapest',
    );

    put.flush(saved(TRIP, 'CHEAPEST'));
    await reloaded(afterMove(TRIP, 'CHEAPEST'));

    expect(page.querySelector('tbody tr')?.getAttribute('aria-busy')).toBeNull();
    expect(page.querySelector('tbody tr')?.textContent).toContain('Cheapest');
  });

  it('moves focus to the title link in the new column after a card menu move, and back on failure', async () => {
    const toasts = TestBed.inject(ToastService);
    document.body.appendChild(page);
    await load([TRIP, SOLO_TRIP]);
    await showBoard();
    menuButton('Berlin to Vienna').click();
    await settle();
    const item = Array.from(page.querySelectorAll<HTMLButtonElement>('.menu-panel button')).find(
      (button) => button.textContent?.includes('Move to Balanced'),
    );
    item?.click();
    TestBed.tick();
    const put = expectPut('BALANCED');
    await settle();

    expect(document.activeElement).toBe(column('BALANCED').querySelector('.trip__title a'));

    put.flush(
      { title: 'Server Error', detail: 'Down.', status: 500 },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();

    expect(titlesIn('GREENEST')).toEqual(['Berlin to Vienna']);
    expect(document.activeElement).toBe(column('GREENEST').querySelector('.trip__title a'));
    toasts.dismiss(toasts.toasts()[0].id);
    page.remove();
  });

  it('drags a card to another column, which is highlighted while the pointer is over it', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();

    dragBerlinTo(250);
    await settle();

    expect(ghost()).not.toBeNull();
    expect(column('CHEAPEST').classList).toContain('column--target');
    expect(column('GREENEST').classList).not.toContain('column--target');
    expect(slot('Berlin to Vienna').classList).toContain('slot--source');

    pointer(document, 'pointerup', 250, 60);
    TestBed.tick();
    const put = expectPut('CHEAPEST');
    await settle();

    expect(ghost()).toBeNull();
    expect(column('CHEAPEST').classList).not.toContain('column--target');
    expect(titlesIn('CHEAPEST')).toEqual(['Berlin to Vienna']);
    expect(titlesIn('GREENEST')).toEqual([]);
    expect(column('CHEAPEST').querySelector('article')?.getAttribute('aria-busy')).toBe('true');

    put.flush(saved(TRIP, 'CHEAPEST'));
    await reloaded(afterMove(TRIP, 'CHEAPEST'));
    await afterClick();

    expect(titlesIn('CHEAPEST')).toEqual(['Berlin to Vienna']);
    expect(column('CHEAPEST').querySelector('article')?.getAttribute('aria-busy')).toBeNull();
  });

  it('puts the trip back in its column and place and shows an error toast when saving fails', async () => {
    const toasts = TestBed.inject(ToastService);
    await load([SOLO_TRIP, LATER, TRIP]);
    await showBoard();
    expect(titlesIn('FASTEST')).toEqual(['Solo to Paris', 'Later']);

    layOutColumns();
    pointer(titleLink('Solo to Paris'), 'pointerdown', 50, 50);
    pointer(document, 'pointermove', 250, 60);
    pointer(document, 'pointerup', 250, 60);
    TestBed.tick();
    const put = httpTesting.expectOne({ method: 'PUT', url: `${TRIPS_URL}/8` });
    await settle();
    expect(titlesIn('CHEAPEST')).toEqual(['Solo to Paris']);

    put.flush(
      { title: 'Server Error', detail: 'Database is down.', status: 500 },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    await afterClick();

    expect(titlesIn('FASTEST')).toEqual(['Solo to Paris', 'Later']);
    expect(titlesIn('CHEAPEST')).toEqual([]);
    expect(column('FASTEST').querySelector('article')?.getAttribute('aria-busy')).toBeNull();
    const [toast] = toasts.toasts();
    expect(toast.kind).toBe('error');
    expect(toast.message).toBe('Couldn\'t move "Solo to Paris" to Cheapest. Database is down.');
    expect(toast.action?.label).toBe('Retry');

    toast.action?.run();
    TestBed.tick();
    const retry = httpTesting.expectOne({ method: 'PUT', url: `${TRIPS_URL}/8` });
    expect(retry.request.body.priority).toBe('CHEAPEST');
    retry.flush(saved(SOLO_TRIP, 'CHEAPEST'));
    await reloaded(afterMove(SOLO_TRIP, 'CHEAPEST'));
    toasts.dismiss(toast.id);

    expect(titlesIn('CHEAPEST')).toEqual(['Solo to Paris']);
  });

  // Known defect: the column count comes from the API's totals and is not updated by the optimistic move.
  it('shows a moved card in a column the API counts as empty while the move is pending', async () => {
    await load([TRIP, SOLO_TRIP]);
    httpTesting.expectNone(isSearch);
    const radio = Array.from(page.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (button) => button.textContent?.includes('Board'),
    );
    radio?.click();
    TestBed.tick();
    await Promise.resolve();
    httpTesting.match(isSearch).forEach((request) => request.flush(pageOf(current)));
    await settle();

    menuButton('Berlin to Vienna').click();
    await settle();
    const item = Array.from(page.querySelectorAll<HTMLButtonElement>('.menu-panel button')).find(
      (button) => button.textContent?.includes('Move to Balanced'),
    );
    item?.click();
    TestBed.tick();
    const put = expectPut('BALANCED');
    await settle();

    try {
      expect(titlesIn('BALANCED')).toEqual(['Berlin to Vienna']);
    } finally {
      put.flush(saved(TRIP, 'BALANCED'));
      await reloaded(afterMove(TRIP, 'BALANCED'));
    }
  });

  it('ignores a drop on the same column', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();

    dragBerlinTo(470);
    expect(ghost()).not.toBeNull();
    expect(column('GREENEST').classList).not.toContain('column--target');
    pointer(document, 'pointerup', 470, 60);
    await settle();
    await afterClick();

    httpTesting.expectNone({ method: 'PUT' });
    expect(ghost()).toBeNull();
    expect(titlesIn('GREENEST')).toEqual(['Berlin to Vienna']);
  });

  it('cancels with Escape and when dropped outside the columns', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();

    dragBerlinTo(250);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(ghost()).toBeNull();
    expect(column('CHEAPEST').classList).not.toContain('column--target');
    pointer(document, 'pointerup', 250, 60);
    await afterClick();

    dragBerlinTo(150);
    pointer(document, 'pointerup', 150, 60);
    await settle();
    await afterClick();

    httpTesting.expectNone({ method: 'PUT' });
    expect(titlesIn('GREENEST')).toEqual(['Berlin to Vienna']);
  });

  it('keeps a small movement a click that opens the trip', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    layOutColumns();
    pointer(titleLink('Berlin to Vienna'), 'pointerdown', 450, 50);
    pointer(document, 'pointermove', 452, 51);
    expect(ghost()).toBeNull();
    pointer(document, 'pointerup', 452, 51);
    titleLink('Berlin to Vienna').click();

    expect(String(navigate.mock.calls[0][0])).toBe('/trips/7');
    httpTesting.expectNone({ method: 'PUT' });
  });

  it('does not open the trip behind a card that was dragged', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const link = titleLink('Berlin to Vienna');

    dragBerlinTo(250);
    pointer(document, 'pointerup', 250, 60);
    link.click();
    TestBed.tick();
    expectPut('CHEAPEST');
    await afterClick();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not start a drag from a button of the card', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();

    layOutColumns();
    pointer(menuButton('Berlin to Vienna'), 'pointerdown', 450, 50);
    pointer(document, 'pointermove', 250, 60);
    pointer(document, 'pointerup', 250, 60);

    expect(ghost()).toBeNull();
    httpTesting.expectNone({ method: 'PUT' });
  });

  it('moves a trip from the card menu on the board', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();

    menuButton('Berlin to Vienna').click();
    await settle();
    const item = Array.from(page.querySelectorAll<HTMLButtonElement>('.menu-panel button')).find(
      (button) => button.textContent?.includes('Move to Balanced'),
    );
    item?.click();
    TestBed.tick();
    const put = expectPut('BALANCED');
    await settle();

    expect(titlesIn('BALANCED')).toEqual(['Berlin to Vienna']);

    put.flush(saved(TRIP, 'BALANCED'));
    await reloaded(afterMove(TRIP, 'BALANCED'));
  });

  it('waits for a long press before a finger drags, and lets a moving finger scroll', async () => {
    await load([TRIP, SOLO_TRIP]);
    await showBoard();
    vi.useFakeTimers();
    try {
      layOutColumns();
      const link = titleLink('Berlin to Vienna');
      const touch = { pointerType: 'touch' };

      pointer(link, 'pointerdown', 450, 50, touch);
      pointer(document, 'pointermove', 250, 60, touch);
      vi.advanceTimersByTime(500);
      expect(ghost()).toBeNull();
      pointer(document, 'pointerup', 250, 60, touch);

      pointer(link, 'pointerdown', 450, 50, touch);
      vi.advanceTimersByTime(500);
      expect(ghost()).not.toBeNull();
      pointer(document, 'pointermove', 250, 60, touch);
      pointer(document, 'pointerup', 250, 60, touch);
    } finally {
      vi.runAllTimers();
      vi.useRealTimers();
    }
    await finishMove(TRIP, 'CHEAPEST');
    await afterClick();
  });
});
