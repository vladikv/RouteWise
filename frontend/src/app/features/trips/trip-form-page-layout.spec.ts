import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api-config';
import { mockViewport } from '../../shared/util/viewport.testing';
import { TripFormPage } from './trip-form-page';
import { CITIES, TRIP } from './trip-form.testing';

const API = 'http://api.test/api';

describe('TripFormPage layout', () => {
  let viewport: ReturnType<typeof mockViewport>;

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    viewport.restore();
  });

  async function open(width: number, id?: string): Promise<HTMLElement> {
    viewport = mockViewport(width);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    const fixture = TestBed.createComponent(TripFormPage);
    if (id) {
      fixture.componentRef.setInput('id', id);
    }
    fixture.detectChanges();
    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.expectOne(`${API}/cities`).flush(CITIES);
    if (id) {
      httpTesting.expectOne(`${API}/trips/${id}`).flush(TRIP);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** The blocks of the page's grid in order (the form's host adds no box of its own). */
  function blocks(page: HTMLElement): string[] {
    return Array.from(page.querySelectorAll('.layout > section, .layout > app-trip-form > *')).map(
      (block) => Array.from(block.classList).find((name) => name !== 'card') ?? '',
    );
  }

  it('from 1280 px: describe, globe and form in columns; the globe fills, the side columns scroll', async () => {
    const page = await open(1440);

    expect(blocks(page)).toEqual(['draft', 'map-panel', 'fields']);
    expect(page.querySelector('.map-panel')?.classList).toContain('map-panel--fill');
    expect(page.querySelector('app-route-map')?.classList).toContain('fill');
    expect(page.querySelector('.draft')?.getAttribute('tabindex')).toBe('0');
    expect(page.querySelector('.fields__scroll')?.getAttribute('tabindex')).toBe('0');
    expect(page.querySelector('.fields')?.getAttribute('aria-label')).toBe('Trip details');
  });

  it('from 1280 px: the three columns are cells of one grid row, so they have equal height', async () => {
    const page = await open(1440);

    const layout = page.querySelector('.layout') as HTMLElement;
    const cells = Array.from(
      layout.querySelectorAll(':scope > section, :scope > app-trip-form > *'),
    );
    expect(cells).toHaveLength(3);
    expect(page.querySelector('.trip-page')?.querySelector(':scope > .layout')).toBe(layout);
  });

  it('the description grows into the free space with the examples, the button and the note below it', async () => {
    const page = await open(1440);

    const form = page.querySelector('.draft form') as HTMLElement;
    const order = Array.from(
      form.querySelectorAll('textarea, .examples, button[type="submit"]'),
    ).map((element) => element.tagName.toLowerCase());
    expect(order).toEqual(['textarea', 'div', 'button']);
    expect(form.querySelector('.field')?.contains(form.querySelector('textarea'))).toBe(true);
    expect(form.querySelector('.field')?.contains(form.querySelector('.examples'))).toBe(false);
  });

  it('Notes is the growing field of the card, and the Create / Cancel bar is its last row, inside the form', async () => {
    const page = await open(1440);

    const scroll = page.querySelector('.fields__scroll') as HTMLElement;
    const notes = scroll.querySelector('.notes') as HTMLElement;
    expect(notes.querySelector('textarea#trip-notes')).not.toBeNull();
    expect(notes.parentElement).toBe(scroll);
    expect(scroll.lastElementChild).toBe(notes);
    const bar = page.querySelector('.fields form > .actions') as HTMLElement;
    expect(bar.previousElementSibling).toBe(scroll);
    expect(bar.querySelector('button[type="submit"]')?.textContent).toContain('Create trip');
    expect(bar.querySelector('a')?.textContent).toContain('Cancel');
  });

  it('What matters most is four options in one grid, never loose', async () => {
    const page = await open(1440);

    const options = page.querySelectorAll('.priority .priority__box > .segmented > label');
    expect(Array.from(options).map((label) => label.textContent?.trim())).toEqual([
      'Balanced',
      'Fastest',
      'Cheapest',
      'Greenest',
    ]);
  });

  it('below 1280 px: the same blocks stacked, the globe keeps its shape and nothing scrolls inside', async () => {
    const page = await open(1024);

    expect(blocks(page)).toEqual(['draft', 'map-panel', 'fields']);
    expect(page.querySelector('.map-panel')?.classList).not.toContain('map-panel--fill');
    expect(page.querySelector('app-route-map')?.classList).not.toContain('fill');
    expect(page.querySelector('.draft')?.hasAttribute('tabindex')).toBe(false);
    expect(page.querySelector('.fields')?.hasAttribute('tabindex')).toBe(false);
  });

  it('editing drops the description: globe and form only', async () => {
    const page = await open(1440, '7');

    expect(page.querySelector('.trip-page')?.classList).toContain('trip-page--edit');
    expect(blocks(page)).toEqual(['map-panel', 'fields']);
  });
});
