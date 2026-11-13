import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api-config';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { mockViewport } from '../../shared/util/viewport.testing';
import { COMPARISON } from '../trips/comparison/comparison.testing';
import { CITIES } from '../trips/trip-form.testing';
import { HOME_LAYOUT_STORAGE_KEY } from './home-layout';
import { RouteExplorer } from './route-explorer';

const COMPARISONS_URL = 'http://api.test/api/comparisons';

describe('RouteExplorer layouts', () => {
  let httpTesting: HttpTestingController;
  let fixture: ComponentFixture<RouteExplorer>;
  let explorer: HTMLElement;
  let viewport: ReturnType<typeof mockViewport>;

  beforeEach(async () => {
    localStorage.clear();
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
  });

  afterEach(() => {
    httpTesting.verify();
    viewport.restore();
    localStorage.clear();
  });

  async function render(width: number, saved?: 'map' | 'split'): Promise<void> {
    viewport = mockViewport(width);
    if (saved) {
      localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, saved);
    }
    fixture = TestBed.createComponent(RouteExplorer);
    explorer = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    httpTesting.expectOne('http://api.test/api/cities').flush(CITIES);
    await fixture.whenStable();
  }

  const count = (selector: string): number => explorer.querySelectorAll(selector).length;
  const stage = (): HTMLElement => explorer.querySelector('.stage') as HTMLElement;
  const arrangement = (): string[] =>
    Array.from(stage().classList).filter((name) => name.startsWith('stage--'));
  const toggle = (heading: string): HTMLButtonElement =>
    Array.from(explorer.querySelectorAll<HTMLButtonElement>('button.toggle')).find((button) =>
      button.textContent?.includes(heading),
    ) as HTMLButtonElement;
  const layoutRadio = (label: string): HTMLButtonElement =>
    Array.from(explorer.querySelectorAll<HTMLButtonElement>('.stage__toolbar [role="radio"]')).find(
      (radio) => radio.textContent?.includes(label),
    ) as HTMLButtonElement;

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

  async function compare(): Promise<void> {
    await pick('Berlin');
    await pick('Vienna');
    httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
    await fixture.whenStable();
  }

  describe('Map (1440 px and wider)', () => {
    beforeEach(() => render(1920, 'map'));

    it('floats a settings panel and a results panel over a map that fills the stage', () => {
      expect(arrangement()).toEqual(['stage--map']);
      expect(count('.stage__map app-route-map')).toBe(1);
      expect(count('.dock--form app-glass-panel')).toBe(1);
      expect(count('.dock--results app-glass-panel')).toBe(1);
      expect(count('app-bottom-sheet')).toBe(0);
      expect(explorer.querySelector('h1')).toBe(explorer.querySelector('.dock--form .heading'));
      expect(explorer.querySelector('.dock--form .heading')?.textContent).toContain(
        'Find the best way to get there',
      );
      expect(explorer.querySelector('.dock--form a[href="/trips/new"]')?.textContent).toContain(
        'Describe a trip instead',
      );
      expect(explorer.querySelector('.dock--form a[href="/trips"]')?.textContent).toContain(
        'View trips',
      );
      expect(explorer.querySelector('.frame--fill.frame--controls-end')).not.toBeNull();
    });

    it('collapses the empty results panel into a hint, and expands it with the results', async () => {
      const results = explorer.querySelector('.dock--results') as HTMLElement;
      expect(results.classList).toContain('dock--idle');
      expect(results.querySelector('.hint-chip')?.textContent).toContain(
        'Pick two cities to compare',
      );

      await compare();
      expect(results.classList).not.toContain('dock--idle');
      expect(results.querySelector('.insight')).not.toBeNull();
      expect(results.querySelectorAll('[role="tab"]')).toHaveLength(4);
      expect(results.querySelector('.badge--recommended')).not.toBeNull();
      expect(results.querySelector('app-weather-card')).not.toBeNull();
      expect(results.querySelector('details.exact table')).not.toBeNull();
    });

    it('has scrollable panel regions that can take focus', () => {
      const regions = Array.from(explorer.querySelectorAll('.dock__scroll'));
      expect(regions).toHaveLength(2);
      for (const region of regions) {
        expect(region.getAttribute('role')).toBe('region');
        expect(region.getAttribute('tabindex')).toBe('0');
        expect(region.getAttribute('aria-label')).toBeTruthy();
      }
      expect(stage().querySelector('.stage__side')?.getAttribute('tabindex')).toBeNull();
    });

    it('collapses a panel to a tab button that reopens it', async () => {
      const button = toggle('Find the best way');
      const body = explorer.querySelector(`#${button.getAttribute('aria-controls')}`);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(body?.hasAttribute('hidden')).toBe(false);

      button.click();
      await fixture.whenStable();
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(body?.hasAttribute('hidden')).toBe(true);
      expect(explorer.querySelector('.dock--form')?.classList).toContain('dock--collapsed');
      expect(toggle('Comparison').getAttribute('aria-expanded')).toBe('true');

      button.click();
      await fixture.whenStable();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(body?.hasAttribute('hidden')).toBe(false);
    });

    it('offers the layout toggle with Map selected', () => {
      expect(layoutRadio('Map').getAttribute('aria-checked')).toBe('true');
      expect(layoutRadio('Split').getAttribute('aria-checked')).toBe('false');
      expect(layoutRadio('Map').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Split', () => {
    it('is the default: the map beside one column with the settings and the results', async () => {
      await render(1920);
      expect(arrangement()).toEqual(['stage--split']);
      expect(layoutRadio('Split').getAttribute('aria-checked')).toBe('true');
      expect(count('button.toggle')).toBe(0);
      expect(explorer.querySelector('h1')).toBe(explorer.querySelector('.dock--form .heading'));
      expect(explorer.querySelector('.dock--results .placeholder')).not.toBeNull();
      // The column scrolls as one focusable region, the docks do not scroll on their own.
      const side = explorer.querySelector('.stage__side') as HTMLElement;
      expect(side.getAttribute('role')).toBe('region');
      expect(side.getAttribute('tabindex')).toBe('0');
      expect(side.getAttribute('aria-label')).toBeTruthy();
      expect(explorer.querySelector('.dock__scroll')?.getAttribute('tabindex')).toBeNull();
    });

    it('stacks map, settings and results below 1024 px, where nothing scrolls separately', async () => {
      await render(900);
      expect(arrangement()).toEqual(['stage--split']);
      const children = Array.from(stage().children).map((child) => child.className);
      expect(children).toEqual(['stage__map', 'stage__side']);
      expect(explorer.querySelector('.stage__side')?.getAttribute('tabindex')).toBeNull();
      expect(count('.stage__toolbar')).toBe(0);
    });

    it('shows Split below 1440 px without offering Map or overwriting the saved choice', async () => {
      await render(1280, 'map');
      expect(arrangement()).toEqual(['stage--split']);
      expect(count('.stage__toolbar')).toBe(0);
      expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe('map');

      viewport.resize(1600);
      await fixture.whenStable();
      expect(arrangement()).toEqual(['stage--map']);
    });
  });

  describe('phones (below 768 px)', () => {
    beforeEach(() => render(375, 'map'));

    it('hosts the settings and results once, inside the bottom sheet', () => {
      expect(arrangement()).toEqual(['stage--sheet']);
      const sheet = explorer.querySelector('app-bottom-sheet') as HTMLElement;
      expect(sheet).not.toBeNull();
      expect(sheet.querySelector('#explorer-date')).not.toBeNull();
      expect(sheet.querySelector('app-priority-picker')).not.toBeNull();
      expect(sheet.querySelector('.placeholder')).not.toBeNull();
      expect(count('#explorer-date')).toBe(1);
      expect(count('app-city-picker')).toBe(2);
      expect(count('app-glass-panel')).toBe(0);
      expect(count('.stage__toolbar')).toBe(0);
    });

    it('shows a one-line summary in the peek and expands with the handle', async () => {
      expect(explorer.querySelector('.summary')?.textContent).toContain('Where are you going?');

      const handle = explorer.querySelector('button.handle') as HTMLButtonElement;
      expect(handle.getAttribute('aria-expanded')).toBe('false');
      handle.click();
      await fixture.whenStable();
      expect(handle.getAttribute('aria-expanded')).toBe('true');
      expect(explorer.querySelector('.body')?.hasAttribute('inert')).toBe(false);
    });
  });

  describe('switching between Map and Split', () => {
    beforeEach(() => render(1920, 'map'));

    async function choose(label: string): Promise<void> {
      layoutRadio(label).click();
      await fixture.whenStable();
    }

    it('saves the choice and changes only the arrangement', async () => {
      await choose('Split');
      expect(arrangement()).toEqual(['stage--split']);
      expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe('split');

      await choose('Map');
      expect(arrangement()).toEqual(['stage--map']);
      expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe('map');
    });

    it('keeps the same elements, the form values and the results, and fetches nothing', async () => {
      await compare();
      (
        explorer.querySelector('app-priority-picker input[value="GREENEST"]') as HTMLInputElement
      ).click();
      await settle();
      httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
      await fixture.whenStable();
      const travelersMore = explorer.querySelector(
        'button[aria-label="One traveler more"]',
      ) as HTMLButtonElement;
      travelersMore.click();
      await settle();
      httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
      await fixture.whenStable();

      const before = {
        date: explorer.querySelector('#explorer-date'),
        picker: explorer.querySelector('app-city-picker'),
        results: explorer.querySelector('.results__content'),
        map: explorer.querySelector('app-route-map svg'),
        side: explorer.querySelector('.stage__side'),
      };
      const dateValue = (before.date as HTMLInputElement).value;
      const originText = explorer
        .querySelector('app-city-picker input')
        ?.getAttribute('aria-label');

      await choose('Split');
      await choose('Map');
      await choose('Split');
      httpTesting.expectNone(() => true);

      expect(explorer.querySelector('#explorer-date')).toBe(before.date);
      expect(explorer.querySelector('app-city-picker')).toBe(before.picker);
      expect(explorer.querySelector('.results__content')).toBe(before.results);
      expect(explorer.querySelector('app-route-map svg')).toBe(before.map);
      expect(explorer.querySelector('.stage__side')).toBe(before.side);
      expect((explorer.querySelector('#explorer-date') as HTMLInputElement).value).toBe(dateValue);
      expect(explorer.querySelector('app-city-picker input')?.getAttribute('aria-label')).toBe(
        originText,
      );
      expect(
        (explorer.querySelector('app-priority-picker input[value="GREENEST"]') as HTMLInputElement)
          .checked,
      ).toBe(true);
      expect(explorer.querySelector('.stepper__value')?.textContent).toContain('2');
      expect(explorer.querySelector('.badge--recommended')).not.toBeNull();
    });

    it('keeps the map view the user set', async () => {
      const svg = explorer.querySelector('app-route-map svg') as SVGElement;
      const initial = svg.getAttribute('viewBox');
      svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true, cancelable: true }));
      await fixture.whenStable();
      const viewBox = svg.getAttribute('viewBox');
      expect(viewBox).not.toBe(initial);

      await choose('Split');
      await choose('Map');

      expect(explorer.querySelector('app-route-map svg')).toBe(svg);
      expect(svg.getAttribute('viewBox')).toBe(viewBox);
    });
  });
});
