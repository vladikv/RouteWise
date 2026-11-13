import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { LAND_LOADER, RouteMap, RouteSelection } from './route-map';

const at = (id: number, name: string, latitude: number, longitude: number, labelRank = 1) =>
  makeCity({ id, name, latitude, longitude, labelRank });

const BERLIN = at(3, 'Berlin', 52.52, 13.405);
const PARIS = at(18, 'Paris', 48.8566, 2.3522);
const VIENNA = at(23, 'Vienna', 48.2082, 16.3738);
const LISBON = at(30, 'Lisbon', 38.7223, -9.1393);
/** Almost on top of Berlin, as Abu Dhabi is on Dubai. */
const TWIN = at(31, 'Twin', 52.52, 15.3);

describe('RouteMap interaction', () => {
  let fixture: ComponentFixture<RouteMap>;
  let map: HTMLElement;
  let selections: RouteSelection[];

  async function render(
    cities = [BERLIN, PARIS, VIENNA, LISBON],
    inputs: Record<string, unknown> = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', cities);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    selections = [];
    fixture.componentInstance.selectionChange.subscribe((selection) => selections.push(selection));
    map = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: true })));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const maybeCity = (name: string) =>
    Array.from(map.querySelectorAll<SVGGElement>('g.city')).find((g) =>
      g.getAttribute('aria-label')?.startsWith(name),
    ) ?? null;
  const city = (name: string): SVGGElement => {
    const marker = maybeCity(name);
    if (!marker) {
      throw new Error(`No city ${name}`);
    }
    return marker;
  };
  const svg = () => map.querySelector('svg') as SVGSVGElement;
  const radius = () => Number(map.querySelector('circle.sea')?.getAttribute('r'));
  const centre = (name: string) => {
    const hit = city(name).querySelector('.city__hit');
    return { x: Number(hit?.getAttribute('cx')), y: Number(hit?.getAttribute('cy')) };
  };
  const hitRadius = (name: string) =>
    Number(city(name).querySelector('.city__hit')?.getAttribute('r'));
  const labelled = () =>
    Array.from(map.querySelectorAll('.city__name')).map((t) => t.textContent?.trim());
  const zoomButton = (label: string) =>
    map.querySelector<HTMLButtonElement>(
      `.zoom button[aria-label="${label}"]`,
    ) as HTMLButtonElement;
  const keydown = async (target: Element, key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await fixture.whenStable();
    return event;
  };
  const wheel = async (init: WheelEventInit) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    svg().dispatchEvent(event);
    await fixture.whenStable();
    return event;
  };

  describe('click targets', () => {
    it('keep clear of each other: half the distance to the nearest city, between 6.5 and 17 px', async () => {
      await render([BERLIN, TWIN, PARIS, VIENNA]);

      const apart = Math.hypot(
        centre('Berlin').x - centre('Twin').x,
        centre('Berlin').y - centre('Twin').y,
      );
      expect(apart).toBeGreaterThan(4);
      expect(apart).toBeLessThan(9);
      expect(hitRadius('Berlin')).toBe(6.5);
      expect(hitRadius('Twin')).toBe(6.5);

      for (const name of ['Paris', 'Vienna']) {
        const others = ['Berlin', 'Twin', 'Paris', 'Vienna'].filter((other) => other !== name);
        const nearest = Math.min(
          ...others.map((other) =>
            Math.hypot(centre(name).x - centre(other).x, centre(name).y - centre(other).y),
          ),
        );
        expect(hitRadius(name)).toBeCloseTo(Math.min(17, Math.max(6.5, nearest / 2)), 6);
      }
    });
  });

  describe('keyboard', () => {
    it('selects with Enter right after a drag (the key is not the end of the drag)', async () => {
      await render();
      const touch = (type: string, x: number) =>
        svg().dispatchEvent(
          new PointerEvent(type, { pointerId: 1, clientX: x, clientY: 100, bubbles: true }),
        );
      touch('pointerdown', 100);
      touch('pointermove', 130);
      touch('pointerup', 130);
      await fixture.whenStable();

      await keydown(city('Berlin'), 'Enter');

      expect(selections).toEqual([{ originId: 3, destinationId: null }]);
    });

    it('has one tab stop: the origin, or the city that had focus last', async () => {
      await render();
      const tabStops = () =>
        Array.from(map.querySelectorAll('g.city'))
          .filter((g) => g.getAttribute('tabindex') === '0')
          .map((g) => g.getAttribute('aria-label'));

      expect(tabStops()).toEqual(['Berlin']); // first by importance

      fixture.componentRef.setInput('originId', 23);
      await fixture.whenStable();
      expect(tabStops()).toEqual(['Vienna, origin']);

      city('Paris').focus();
      await fixture.whenStable();
      expect(tabStops()).toEqual(['Paris']);
      expect(city('Berlin').getAttribute('tabindex')).toBe('-1');
    });

    it('says in its label how to get to and between the cities', async () => {
      await render();

      expect(svg().getAttribute('aria-label')).toContain('Choose an origin, then a destination.');
      expect(svg().getAttribute('aria-label')).toContain('Tab to the cities, arrow keys move');
    });

    it('keeps a focused city in view when zooming with the keys, and leaves focus on reset', async () => {
      await render();
      city('Lisbon').focus();

      for (let i = 0; i < 6; i++) {
        await keydown(city('Lisbon'), '+');
      }
      expect(document.activeElement).toBe(city('Lisbon'));
      expect(radius()).toBeGreaterThan(1000);

      await keydown(city('Lisbon'), '0');
      expect(document.activeElement).toBe(svg());
    });

    it('closes the hover card on Escape', async () => {
      await render();
      city('Vienna').dispatchEvent(new PointerEvent('pointerenter'));
      await fixture.whenStable();
      expect(map.querySelector('.card-tip')).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(map.querySelector('.card-tip')).toBeNull();
    });
  });

  describe('crowded cities', () => {
    it('labels a rank 1 city although low-ranked cities crowd it, and leaves those out', async () => {
      const crowd = [
        at(40, 'East', 52.52, 13.405 + 1),
        at(41, 'West', 52.52, 13.405 - 1),
        at(42, 'North', 52.52 + 0.6, 13.405),
        at(43, 'South', 52.52 - 0.6, 13.405),
      ].map((c) => ({ ...c, labelRank: 3 }));
      await render([BERLIN, ...crowd]);

      expect(labelled()).toEqual(['Berlin']);
      expect(map.querySelectorAll('g.city')).toHaveLength(1);
    });
  });

  describe('free area in fill mode', () => {
    it('draws and labels only the cities between the panels', async () => {
      const size = { width: 1440, height: 826 };
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
        () => ({ ...size, top: 0, left: 0, right: 1440, bottom: 826, x: 0, y: 0 }) as DOMRect,
      );
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe = vi.fn();
          disconnect = vi.fn();
        },
      );
      await render([BERLIN, PARIS, VIENNA, LISBON], {
        fill: true,
        insetStart: 500,
        insetEnd: 300,
      });
      fixture.detectChanges();
      await fixture.whenStable();
      await wheel({ deltaY: -100000 }); // 8x

      expect(maybeCity('Lisbon')).toBeNull();
      expect(map.querySelectorAll('g.city').length).toBeGreaterThan(0);
      for (const name of ['Berlin', 'Paris', 'Vienna']) {
        const found = maybeCity(name);
        if (found) {
          expect(centre(name).x).toBeGreaterThanOrEqual(500);
          expect(centre(name).x).toBeLessThanOrEqual(1140);
        }
      }
      for (const text of Array.from(map.querySelectorAll('.city__name'))) {
        const x = Number(text.getAttribute('x'));
        expect(x).toBeGreaterThanOrEqual(500);
        expect(x).toBeLessThanOrEqual(1140);
      }
    });
  });

  describe('toolbar zone', () => {
    it('keeps labels out of a box reserved at the top', async () => {
      await render();
      expect(labelled()).toContain('Berlin');

      fixture.componentRef.setInput('topZone', { width: 640, height: 340, align: 'start' });
      await fixture.whenStable();

      expect(labelled()).not.toContain('Berlin');
    });
  });

  describe('gestures', () => {
    it('greedy: the wheel zooms and is kept from scrolling the page, except at the limits', async () => {
      await render();
      const base = radius();

      const zoomIn = await wheel({ deltaY: -300 });
      expect(zoomIn.defaultPrevented).toBe(true);
      expect(radius()).toBeGreaterThan(base);

      await wheel({ deltaY: 100000 });
      expect(radius()).toBeCloseTo(base, 3);
      const atMinimum = await wheel({ deltaY: 300 });
      expect(atMinimum.defaultPrevented).toBe(false);

      await wheel({ deltaY: -100000 });
      const atMaximum = await wheel({ deltaY: -300 });
      expect(atMaximum.defaultPrevented).toBe(false);
    });

    it('cooperative: a plain wheel scrolls the page and shows a hint; Ctrl + wheel zooms', async () => {
      await render([BERLIN, PARIS], { gestures: 'cooperative' });
      const base = radius();
      expect(map.querySelector('.frame--cooperative')).not.toBeNull();
      expect(map.querySelector('.hint')?.textContent).toContain('Ctrl + scroll or pinch');

      const plain = await wheel({ deltaY: -300 });
      expect(plain.defaultPrevented).toBe(false);
      expect(radius()).toBe(base);
      expect(map.querySelector('.scroll-hint')?.textContent).toContain('Ctrl + scroll to zoom');

      const withCtrl = await wheel({ deltaY: -300, ctrlKey: true });
      expect(withCtrl.defaultPrevented).toBe(true);
      expect(radius()).toBeGreaterThan(base);
    });

    it('greedy is the default and shows no cooperative styling', async () => {
      await render();

      expect(map.querySelector('.frame--cooperative')).toBeNull();
      expect(map.querySelector('.scroll-hint')).toBeNull();
    });
  });

  describe('coastlines', () => {
    it('is busy while the land loads and says so when it cannot be loaded', async () => {
      let fail: (reason: Error) => void = () => undefined;
      TestBed.overrideProvider(LAND_LOADER, {
        useValue: () =>
          new Promise((_, reject) => {
            fail = reject;
          }),
      });
      await render();
      expect(svg().getAttribute('aria-busy')).toBe('true');
      expect(map.querySelector('.note')).toBeNull();

      fail(new Error('chunk failed'));
      await vi.waitFor(() => expect(svg().getAttribute('aria-busy')).toBe('false'));
      await fixture.whenStable();

      expect(map.querySelector('.note')?.textContent).toContain('Coastlines could not be loaded');
      expect(map.querySelector('.note')?.getAttribute('role')).toBe('status');
      expect(city('Berlin')).not.toBeNull(); // the cities still work
    });
  });

  describe('motion', () => {
    function stubMotion(matches: boolean) {
      const frames: FrameRequestCallback[] = [];
      let listener: ((event: { matches: boolean }) => void) | undefined;
      vi.stubGlobal('matchMedia', () => ({
        matches,
        addEventListener: (_: string, callback: typeof listener) => (listener = callback),
        removeEventListener: () => undefined,
      }));
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        frames.push(callback),
      );
      vi.stubGlobal('cancelAnimationFrame', () => undefined);
      return {
        change: (value: boolean) => listener?.({ matches: value }),
        run: async (now: number) => {
          frames.splice(0).forEach((callback) => callback(now));
          await fixture.whenStable();
        },
      };
    }

    it('follows the reduced-motion setting while the page is open', async () => {
      const motion = stubMotion(false);
      await render();
      const base = radius();

      zoomButton('Zoom in').click();
      await fixture.whenStable();
      expect(radius()).toBe(base); // animating: nothing has moved yet

      motion.change(true);
      zoomButton('Zoom in').click();
      await fixture.whenStable();
      expect(radius()).toBeGreaterThan(base * 2.5); // applied at once, on top of the pending zoom
    });

    it('builds a quick second zoom click on the first one still animating', async () => {
      const motion = stubMotion(false);
      await render();
      const base = radius();

      zoomButton('Zoom in').click();
      zoomButton('Zoom in').click();
      await motion.run(1000);
      await motion.run(1000 + 5000);

      expect(radius()).toBeCloseTo(base * 1.6 * 1.6, 3);
    });
  });
});
