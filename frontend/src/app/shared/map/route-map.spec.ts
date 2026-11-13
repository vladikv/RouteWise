import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { RouteMap, RouteSelection, nearestInDirection } from './route-map';

const BERLIN = makeCity({
  id: 3,
  name: 'Berlin',
  country: 'DE',
  latitude: 52.52,
  longitude: 13.405,
});
const VIENNA = makeCity({
  id: 23,
  name: 'Vienna',
  country: 'AT',
  latitude: 48.2082,
  longitude: 16.3738,
});
const PARIS = makeCity({
  id: 18,
  name: 'Paris',
  country: 'FR',
  latitude: 48.8566,
  longitude: 2.3522,
});
/** Rank 3: labelled only from 4x. A few kilometres from Berlin, so its label would not fit at 1x. */
const POTSDAM = makeCity({
  id: 40,
  name: 'Potsdam',
  country: 'DE',
  latitude: 52.39,
  longitude: 13.06,
  labelRank: 3,
});
/** On the far side of the globe while it points at Europe. */
const SYDNEY = makeCity({
  id: 50,
  name: 'Sydney',
  country: 'AU',
  latitude: -33.8688,
  longitude: 151.2093,
  continent: 'OCEANIA',
  landmass: 'AUSTRALIA',
});

describe('RouteMap', () => {
  let fixture: ComponentFixture<RouteMap>;
  let map: HTMLElement;
  let selections: RouteSelection[];

  beforeEach(async () => {
    // Reduced motion: view changes apply at once instead of animating.
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, VIENNA, PARIS, POTSDAM, SYDNEY]);
    selections = [];
    fixture.componentInstance.selectionChange.subscribe((selection) => selections.push(selection));
    map = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  function maybeCity(name: string): SVGGElement | null {
    return (
      Array.from(map.querySelectorAll<SVGGElement>('g.city')).find((g) =>
        g.getAttribute('aria-label')?.startsWith(name),
      ) ?? null
    );
  }

  function city(name: string): SVGGElement {
    const marker = maybeCity(name);
    if (!marker) {
      throw new Error(`No city ${name}`);
    }
    return marker;
  }

  const dot = (name: string) => {
    const element = city(name).querySelector('.city__dot, .city__ring');
    return { x: Number(element?.getAttribute('cx')), y: Number(element?.getAttribute('cy')) };
  };
  const radius = () => Number(map.querySelector('circle.sea')?.getAttribute('r'));
  const svg = () => map.querySelector('svg') as SVGSVGElement;
  const zoomButton = (label: string) =>
    map.querySelector<HTMLButtonElement>(
      `.zoom button[aria-label="${label}"]`,
    ) as HTMLButtonElement;
  const press = async (key: string) => {
    svg().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await fixture.whenStable();
  };
  const wheel = async (deltaY: number) => {
    svg().dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
    await fixture.whenStable();
  };

  async function select(originId: number | null, destinationId: number | null): Promise<void> {
    fixture.componentRef.setInput('originId', originId);
    fixture.componentRef.setInput('destinationId', destinationId);
    await fixture.whenStable();
  }

  it('renders the cities on this side of the globe as labelled, focusable buttons', () => {
    expect(city('Berlin').getAttribute('role')).toBe('button');
    expect(city('Berlin').getAttribute('tabindex')).toBe('0');
    expect(city('Berlin').getAttribute('aria-pressed')).toBe('false');
    expect(city('Berlin').textContent).toContain('Berlin');
    expect(map.querySelector('[role="status"]')?.textContent).toBe('Choose an origin city.');
    expect(map.querySelector('path.route')).toBeNull();
  });

  it('does not render a city on the far side, so it cannot take focus', () => {
    expect(maybeCity('Sydney')).toBeNull();
    expect(map.querySelectorAll('g.city')).toHaveLength(4);
  });

  it('swaps the sides when the globe is turned: Sydney appears and Berlin goes behind it', async () => {
    for (let i = 0; i < 7; i++) {
      await press('ArrowRight'); // 7 x 20 degrees east
    }
    for (let i = 0; i < 4; i++) {
      await press('ArrowDown'); // 4 x 20 degrees south
    }

    expect(maybeCity('Sydney')).not.toBeNull();
    expect(maybeCity('Berlin')).toBeNull();
  });

  it('places cities by their coordinates: Paris west of Berlin, Vienna south of Berlin', () => {
    expect(dot('Paris').x).toBeLessThan(dot('Berlin').x);
    expect(dot('Vienna').y).toBeGreaterThan(dot('Berlin').y);
  });

  it('picks the origin first, then the destination', async () => {
    city('Berlin').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: null });

    await select(3, null);
    expect(city('Berlin').getAttribute('aria-pressed')).toBe('true');
    expect(city('Berlin').getAttribute('aria-label')).toBe('Berlin, origin');
    expect(map.querySelector('[role="status"]')?.textContent).toBe(
      'Origin: Berlin. Choose a destination.',
    );

    city('Vienna').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: 23 });
  });

  it('draws the route as a great-circle path and states it in text once both cities are chosen', async () => {
    await select(3, 23);

    const legs = map.querySelectorAll('path.route:not(.route--halo)');
    expect(legs).toHaveLength(1);
    expect(legs[0].getAttribute('d')).toMatch(/^M[\d.-]+,[\d.-]+L/);
    expect(city('Berlin').querySelector('.city__letter')?.textContent?.trim()).toBe('A');
    expect(city('Vienna').querySelector('.city__letter')?.textContent?.trim()).toBe('B');
    expect(city('Vienna').getAttribute('aria-label')).toBe('Vienna, destination');
    expect(map.querySelector('[role="status"]')?.textContent).toBe(
      'Route from Berlin to Vienna, 524 km straight-line.',
    );
  });

  it('starts a new route on a further pick and clears when the origin is picked again', async () => {
    await select(3, 23);
    city('Paris').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 18, destinationId: null });

    await select(3, null);
    city('Berlin').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: null, destinationId: null });
  });

  it('keeps a destination that was chosen before the origin', async () => {
    await select(null, 23);

    city('Berlin').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: 23 });
  });

  it('can be operated with Enter and Space', () => {
    city('Berlin').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: null });

    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    city('Paris').dispatchEvent(space);
    expect(selections).toHaveLength(2);
    expect(space.defaultPrevented).toBe(true); // no page scroll
  });

  it('shows a read-only route as one described image with only the route cities', async () => {
    fixture.componentRef.setInput('interactive', false);
    await select(3, 23);

    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe(
      'Route from Berlin to Vienna, 524 km straight-line.',
    );
    expect(map.querySelector('[role="button"]')).toBeNull();
    expect(map.querySelector('[role="status"]')).toBeNull();
    expect(map.querySelectorAll('g.city')).toHaveLength(2);

    map.querySelector('g.city')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections).toEqual([]);
  });

  describe('land', () => {
    it('loads the land shapes on demand and draws them as one path', async () => {
      await vi.waitFor(() =>
        expect(map.querySelector('path.land')?.getAttribute('d')).toMatch(/^M[\d.-]+,[\d.-]+L/),
      );
    });
  });

  describe('drag to rotate', () => {
    async function drag(dx: number, dy: number): Promise<void> {
      svg().dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          clientX: 200,
          clientY: 200,
          bubbles: true,
        }),
      );
      svg().dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: 200 + dx,
          clientY: 200 + dy,
          bubbles: true,
        }),
      );
      svg().dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
      await fixture.whenStable();
    }

    it('turns the globe with the pointer: the surface follows it', async () => {
      const before = dot('Berlin');

      await drag(60, 0);

      expect(dot('Berlin').x).toBeGreaterThan(before.x + 40);
    });

    it('turns it vertically too', async () => {
      const before = dot('Berlin');

      await drag(0, 40);

      expect(dot('Berlin').y).toBeGreaterThan(before.y + 20);
    });

    it('does not select a city at the end of a drag, but does on a plain click', async () => {
      const berlin = city('Berlin');
      await drag(60, 0);
      berlin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(selections).toEqual([]);

      berlin.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(selections).toHaveLength(1);
    });

    it('ignores a movement below the drag threshold', async () => {
      const before = dot('Berlin');

      await drag(2, 1);

      expect(dot('Berlin')).toEqual(before);
    });
  });

  describe('zoom', () => {
    it('zooms with the buttons, within the limits', async () => {
      const base = radius();
      expect(zoomButton('Zoom out').disabled).toBe(true);

      zoomButton('Zoom in').click();
      await fixture.whenStable();
      expect(radius()).toBeCloseTo(base * 1.6, 3);
      expect(zoomButton('Zoom out').disabled).toBe(false);

      for (let i = 0; i < 10; i++) {
        zoomButton('Zoom in').click();
        await fixture.whenStable();
      }
      expect(radius()).toBeCloseTo(base * 8, 3);
      expect(zoomButton('Zoom in').disabled).toBe(true);

      for (let i = 0; i < 10; i++) {
        zoomButton('Zoom out').click();
        await fixture.whenStable();
      }
      expect(radius()).toBeCloseTo(base, 3);
    });

    it('zooms with the wheel and keeps within the limits', async () => {
      const base = radius();

      await wheel(-400);
      expect(radius()).toBeGreaterThan(base);

      await wheel(-100000);
      expect(radius()).toBeCloseTo(base * 8, 3);

      await wheel(100000);
      expect(radius()).toBeCloseTo(base, 3);
    });

    it('zooms with the plus and minus keys, but leaves browser shortcuts alone', async () => {
      const base = radius();
      await press('+');
      expect(radius()).toBeGreaterThan(base);
      await press('-');
      expect(radius()).toBeCloseTo(base, 3);

      const shortcut = new KeyboardEvent('keydown', {
        key: '+',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      svg().dispatchEvent(shortcut);
      expect(shortcut.defaultPrevented).toBe(false);
      expect(radius()).toBeCloseTo(base, 3);
    });

    it('zooms with a two-finger pinch', async () => {
      const base = radius();
      const touch = (type: string, id: number, x: number) =>
        svg().dispatchEvent(
          new PointerEvent(type, { pointerId: id, clientX: x, clientY: 100, bubbles: true }),
        );
      touch('pointerdown', 1, 100);
      touch('pointerdown', 2, 200);
      touch('pointermove', 2, 300);
      await fixture.whenStable();

      expect(radius()).toBeCloseTo(base * 2, 3);
      touch('pointerup', 1, 100);
      touch('pointerup', 2, 300);
    });
  });

  describe('keyboard', () => {
    it('rotates the globe with the arrow keys', async () => {
      const before = dot('Berlin');

      await press('ArrowRight');
      expect(dot('Berlin').x).toBeLessThan(before.x); // the view moved east

      await press('ArrowLeft');
      await press('ArrowLeft');
      expect(dot('Berlin').x).toBeGreaterThan(before.x);

      await press('ArrowLeft');
      await press('ArrowUp');
      expect(dot('Berlin').y).toBeGreaterThan(before.y); // the view moved north
    });

    it('moves focus to the nearest city in that direction instead of rotating', async () => {
      const before = dot('Berlin');
      city('Berlin').focus();
      const arrow = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      city('Berlin').dispatchEvent(arrow);
      await fixture.whenStable();

      expect(arrow.defaultPrevented).toBe(true);
      expect(document.activeElement).not.toBe(city('Berlin'));
      expect(document.activeElement?.classList).toContain('city');
      expect(dot('Berlin')).toEqual(before);
    });

    it('rotates when no city lies in that direction', async () => {
      const before = dot('Paris');
      city('Paris').focus();
      city('Paris').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
      );
      await fixture.whenStable();

      expect(dot('Paris').x).toBeGreaterThan(before.x);
    });
  });

  describe('reset view', () => {
    it('restores the initial view after turning and zooming', async () => {
      const before = { berlin: dot('Berlin'), radius: radius() };
      svg().dispatchEvent(
        new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true }),
      );
      svg().dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientX: 90, clientY: 30, bubbles: true }),
      );
      svg().dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
      await wheel(-500);
      expect(dot('Berlin')).not.toEqual(before.berlin);

      zoomButton('Reset view').click();
      await fixture.whenStable();

      expect(radius()).toBeCloseTo(before.radius, 6);
      expect(dot('Berlin').x).toBeCloseTo(before.berlin.x, 6);
      expect(dot('Berlin').y).toBeCloseTo(before.berlin.y, 6);
    });

    it('returns to the route when there is one, and "0" does the same', async () => {
      await select(3, 23);
      const fitted = { radius: radius(), berlin: dot('Berlin') };

      await wheel(500);
      expect(radius()).not.toBeCloseTo(fitted.radius, 3);
      await press('0');

      expect(radius()).toBeCloseTo(fitted.radius, 6);
      expect(dot('Berlin').x).toBeCloseTo(fitted.berlin.x, 6);
    });
  });

  describe('route view', () => {
    it('turns to a newly chosen route and zooms to it, with the route in view', async () => {
      const base = radius();

      await select(3, 23);

      expect(radius()).toBeGreaterThan(base * 2);
      const middle = (dot('Berlin').x + dot('Vienna').x) / 2;
      expect(middle).toBeCloseTo(320, 0); // the middle of the default 640 px wide drawing
    });

    it('goes back to Europe when the route is cleared', async () => {
      const before = { berlin: dot('Berlin'), radius: radius() };
      await select(3, 23);

      await select(null, null);

      expect(radius()).toBeCloseTo(before.radius, 6);
      expect(dot('Berlin').x).toBeCloseTo(before.berlin.x, 6);
    });

    it('turns smoothly unless motion is reduced', async () => {
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
        frames.push(callback),
      );
      vi.stubGlobal('cancelAnimationFrame', () => undefined);
      let now = 1000;
      const animated = TestBed.createComponent(RouteMap);
      animated.componentRef.setInput('cities', [BERLIN, VIENNA, PARIS]);
      await animated.whenStable();
      const element = animated.nativeElement as HTMLElement;
      const r = () => Number(element.querySelector('circle.sea')?.getAttribute('r'));
      const base = r();

      animated.componentRef.setInput('originId', 3);
      animated.componentRef.setInput('destinationId', 23);
      await animated.whenStable();
      expect(r()).toBe(base); // started, not jumped

      const step = async (elapsed: number) => {
        now = 1000 + elapsed;
        frames.splice(0).forEach((callback) => callback(now));
        await animated.whenStable();
      };
      await step(0); // the first frame starts the clock
      await step(350);
      const halfway = r();
      expect(halfway).toBeGreaterThan(base);
      await step(5000);
      const fitted = r();
      expect(fitted).toBeGreaterThan(halfway);
      await step(10000);
      expect(r()).toBe(fitted); // finished
    });
  });

  describe('labels', () => {
    const labelled = () =>
      Array.from(map.querySelectorAll('.city__name')).map((t) => t.textContent?.trim());

    it('labels the most important cities and holds back rank 3 until zoomed in', async () => {
      expect(labelled().sort()).toEqual(['Berlin', 'Paris', 'Vienna']);
      expect(city('Potsdam').querySelector('.city__name')).toBeNull();
      // A hidden label leaves a labelled button.
      expect(city('Potsdam').getAttribute('aria-label')).toBe('Potsdam');
      expect(city('Potsdam').getAttribute('role')).toBe('button');

      // 1.6^3 = 4.1x
      for (let i = 0; i < 3; i++) {
        zoomButton('Zoom in').click();
        await fixture.whenStable();
      }
      expect(labelled()).toContain('Potsdam');
    });

    it('always labels the cities of the selected route', async () => {
      await select(40, 3);

      expect(labelled()).toContain('Potsdam');
      expect(labelled()).toContain('Berlin');
    });
  });

  it('shows a card with the distance from the origin for the city under the pointer', async () => {
    await select(3, null);
    city('Vienna').dispatchEvent(new PointerEvent('pointerenter'));
    await fixture.whenStable();

    const card = map.querySelector('.card-tip')?.textContent?.replace(/\s+/g, ' ');
    expect(card).toContain('Vienna');
    expect(card).toContain('AT');
    expect(card).toContain('524 km from origin');
    expect(card).toContain('Select as destination');

    city('Vienna').dispatchEvent(new PointerEvent('pointerleave'));
    await fixture.whenStable();
    expect(map.querySelector('.card-tip')).toBeNull();
  });
});

describe('nearestInDirection', () => {
  const at = (id: number, x: number, y: number) => ({
    city: makeCity({ id, name: `C${id}` }),
    point: { x, y },
  });
  const places = [
    at(1, 100, 100),
    at(2, 200, 100),
    at(3, 150, 180),
    at(4, 110, 40),
    at(5, 40, 105),
  ];
  const cities = places.map((p) => p.city);
  const points = new Map(places.map((p) => [p.city.id, p.point]));

  it('picks the nearest city within 60° of the arrow direction', () => {
    expect(nearestInDirection(cities[0], { x: 1, y: 0 }, cities, points)?.id).toBe(2);
    expect(nearestInDirection(cities[0], { x: 0, y: 1 }, cities, points)?.id).toBe(3);
    expect(nearestInDirection(cities[0], { x: 0, y: -1 }, cities, points)?.id).toBe(4);
    expect(nearestInDirection(cities[0], { x: -1, y: 0 }, cities, points)?.id).toBe(5);
  });

  it('returns null when nothing lies in that direction', () => {
    expect(nearestInDirection(cities[1], { x: 1, y: 0 }, cities, points)).toBeNull();
  });

  it('ignores cities that are not on the visible side (no point)', () => {
    const visible = new Map([[1, { x: 100, y: 100 }]]);
    expect(nearestInDirection(cities[0], { x: 1, y: 0 }, cities, visible)).toBeNull();
  });
});
