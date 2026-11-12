import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../../core/api/api-config';
import { apiErrorInterceptor } from '../../../core/api/api-error';
import { Comparison, Trip } from '../../../core/api/models';
import { ToastService } from '../../../shared/ui/toast';
import { COMPARISON, MULTI_COMPARISON } from '../comparison/comparison.testing';
import { TripListPage } from '../trip-list-page';
import { TRIP } from '../trip-form.testing';

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
const LATER: Trip = { ...SOLO_TRIP, id: 9, title: 'Later', priority: 'FASTEST' };
const FIGURES: Record<number, Comparison> = { 7: COMPARISON, 8: MULTI_COMPARISON, 9: COMPARISON };

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

  async function load(trips: Trip[]): Promise<void> {
    httpTesting.expectOne(TRIPS_URL).flush(trips);
    for (const trip of trips) {
      httpTesting.expectOne(`${TRIPS_URL}/${trip.id}/comparison`).flush(FIGURES[trip.id]);
    }
    await settle();
  }

  async function showBoard(): Promise<void> {
    const radio = Array.from(page.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (button) => button.textContent?.includes('Board'),
    );
    radio?.click();
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

  async function finishMove(trip: Trip, priority: Trip['priority']): Promise<void> {
    TestBed.tick();
    expectPut(priority).flush(saved(trip, priority));
    TestBed.tick();
    httpTesting.expectOne(`${TRIPS_URL}/${trip.id}/comparison`).flush(COMPARISON);
    await settle();
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
    TestBed.tick();
    httpTesting.expectOne(`${TRIPS_URL}/7/comparison`).flush(COMPARISON);
    await settle();

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
    TestBed.tick();
    httpTesting.expectOne(`${TRIPS_URL}/7/comparison`).flush(COMPARISON);
    await settle();
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
    TestBed.tick();
    httpTesting.expectOne(`${TRIPS_URL}/8/comparison`).flush(MULTI_COMPARISON);
    await settle();
    toasts.dismiss(toast.id);

    expect(titlesIn('CHEAPEST')).toEqual(['Solo to Paris']);
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
    TestBed.tick();
    httpTesting.expectOne(`${TRIPS_URL}/7/comparison`).flush(COMPARISON);
    await settle();
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
