import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api-config';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { LayoutBreakpoint, PageLayout } from '../../shared/util/layout-breakpoint';
import { COMPARISON } from '../trips/comparison/comparison.testing';
import { CITIES } from '../trips/trip-form.testing';
import { RouteExplorer } from './route-explorer';

const COMPARISONS_URL = 'http://api.test/api/comparisons';

describe('RouteExplorer layouts', () => {
  let httpTesting: HttpTestingController;
  let fixture: ComponentFixture<RouteExplorer>;
  let explorer: HTMLElement;
  const layout = signal<PageLayout>('wide');

  beforeEach(async () => {
    layout.set('wide');
    await TestBed.configureTestingModule({
      imports: [RouteExplorer],
      providers: [
        provideRouter([{ path: '', children: [] }]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
        { provide: LayoutBreakpoint, useValue: { layout } },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(RouteExplorer);
    explorer = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    httpTesting.expectOne('http://api.test/api/cities').flush(CITIES);
    await fixture.whenStable();
  }

  const count = (selector: string): number => explorer.querySelectorAll(selector).length;
  const toggle = (heading: string): HTMLButtonElement =>
    Array.from(explorer.querySelectorAll<HTMLButtonElement>('button.toggle')).find((button) =>
      button.textContent?.includes(heading),
    ) as HTMLButtonElement;

  describe('wide', () => {
    beforeEach(render);

    it('floats a settings panel and a results panel over the map', () => {
      expect(count('.stage--wide app-route-map')).toBe(1);
      expect(count('.dock--left app-glass-panel')).toBe(1);
      expect(count('.dock--right app-glass-panel')).toBe(1);
      expect(count('app-bottom-sheet')).toBe(0);
      expect(explorer.querySelector('.dock--left .heading')?.tagName).toBe('H1');
      expect(explorer.querySelector('h1')).toBe(explorer.querySelector('.dock--left .heading'));
      expect(explorer.querySelector('.dock--left .heading')?.textContent).toContain(
        'Find the best way to get there',
      );
      expect(explorer.querySelector('.dock--left a[href="/trips/new"]')?.textContent).toContain(
        'Describe a trip instead',
      );
      expect(explorer.querySelector('.dock--left a[href="/trips"]')?.textContent).toContain(
        'View trips',
      );
      expect(explorer.querySelector('.dock--right .placeholder')).not.toBeNull();
    });

    it('draws the map in fill mode with the zoom controls at the bottom', () => {
      expect(explorer.querySelector('.frame--fill.frame--controls-bottom')).not.toBeNull();
    });

    it('has scrollable panel regions that can take focus', () => {
      const regions = Array.from(explorer.querySelectorAll('.dock__scroll'));
      expect(regions).toHaveLength(2);
      for (const region of regions) {
        expect(region.getAttribute('role')).toBe('region');
        expect(region.getAttribute('tabindex')).toBe('0');
        expect(region.getAttribute('aria-label')).toBeTruthy();
      }
    });

    it('collapses a panel to a tab button that reopens it', async () => {
      const button = toggle('Find the best way');
      const body =
        document.getElementById(button.getAttribute('aria-controls') ?? '') ??
        explorer.querySelector(`#${button.getAttribute('aria-controls')}`);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(body?.hasAttribute('hidden')).toBe(false);

      button.click();
      await fixture.whenStable();
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(body?.hasAttribute('hidden')).toBe(true);
      expect(explorer.querySelector('.dock--left')?.classList).toContain('dock--collapsed');
      // The other panel is not affected.
      expect(toggle('Comparison').getAttribute('aria-expanded')).toBe('true');

      button.click();
      await fixture.whenStable();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(body?.hasAttribute('hidden')).toBe(false);
    });

    it('shows the savings banner, tabs and weather in the results panel', async () => {
      const pick = async (name: string) => {
        const marker = Array.from(explorer.querySelectorAll('g.city')).find((g) =>
          g.getAttribute('aria-label')?.startsWith(name),
        );
        marker?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        for (let i = 0; i < 3; i++) {
          TestBed.tick();
          await Promise.resolve();
        }
      };
      await pick('Berlin');
      await pick('Vienna');
      httpTesting.expectOne(COMPARISONS_URL).flush(COMPARISON);
      await fixture.whenStable();

      const results = explorer.querySelector('.dock--right') as HTMLElement;
      expect(results.querySelector('.insight')).not.toBeNull();
      expect(results.querySelectorAll('[role="tab"]')).toHaveLength(4);
      expect(results.querySelector('.badge--recommended')).not.toBeNull();
      expect(results.querySelector('app-weather-card')).not.toBeNull();
      expect(results.querySelector('details.exact table')).not.toBeNull();
    });
  });

  describe('medium', () => {
    beforeEach(async () => {
      layout.set('medium');
      await render();
    });

    it('stacks the hero, map, settings and results as cards', () => {
      const children = Array.from(explorer.querySelector('.stage')?.children ?? []).map(
        (child) => child.className || child.tagName.toLowerCase(),
      );
      expect(children.slice(0, 2)).toEqual(['hero', 'stage__map']);
      expect(count('.stage > app-glass-panel')).toBe(2);
      expect(count('button.toggle')).toBe(0);
      expect(count('.frame--fill')).toBe(0);
    });
  });

  describe('narrow', () => {
    beforeEach(async () => {
      layout.set('narrow');
      await render();
    });

    it('hosts the settings and results once, inside the bottom sheet', () => {
      const sheet = explorer.querySelector('app-bottom-sheet') as HTMLElement;
      expect(sheet).not.toBeNull();
      expect(sheet.querySelector('#explorer-date')).not.toBeNull();
      expect(sheet.querySelector('app-priority-picker')).not.toBeNull();
      expect(sheet.querySelector('.placeholder')).not.toBeNull();
      expect(count('#explorer-date')).toBe(1);
      expect(count('app-city-picker')).toBe(2);
      expect(count('app-glass-panel')).toBe(0);
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
});
