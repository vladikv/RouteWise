import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { RouteMap } from './route-map';

const CITIES = [
  { id: 3, name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405 },
  { id: 23, name: 'Vienna', country: 'AT', latitude: 48.2082, longitude: 16.3738 },
  { id: 18, name: 'Paris', country: 'FR', latitude: 48.8566, longitude: 2.3522 },
  { id: 5, name: 'Lisbon', country: 'PT', latitude: 38.7223, longitude: -9.1393 },
  { id: 6, name: 'Stockholm', country: 'SE', latitude: 59.3293, longitude: 18.0686 },
].map((city) => makeCity(city));

class FakeResizeObserver {
  static current: FakeResizeObserver | null = null;
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.current = this;
  }
  observe = vi.fn();
  disconnect = vi.fn();
  fire(): void {
    this.callback();
  }
}

describe('RouteMap fill mode', () => {
  let size = { width: 1440, height: 826 };
  let fixture: ComponentFixture<RouteMap>;
  let element: HTMLElement;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          ...size,
          top: 0,
          left: 0,
          right: size.width,
          bottom: size.height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(
    inputs: Record<string, unknown>,
    width = 1440,
    height = 826,
  ): Promise<void> {
    size = { width, height };
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', CITIES);
    fixture.componentRef.setInput('fill', true);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    element = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  async function resize(width: number, height: number): Promise<void> {
    size = { width, height };
    FakeResizeObserver.current?.fire();
    await settle();
  }

  const svg = (): SVGSVGElement => element.querySelector('svg') as SVGSVGElement;
  const disc = () => {
    const sea = element.querySelector('circle.sea') as SVGCircleElement;
    return {
      cx: Number(sea.getAttribute('cx')),
      cy: Number(sea.getAttribute('cy')),
      r: Number(sea.getAttribute('r')),
    };
  };
  /** Zoom relative to the globe fitted into the free space (12 px margin). */
  const zoomLevel = (free: number, height: number) => disc().r / (Math.min(free, height) / 2 - 12);
  const pin = (letter: string): { x: number; y: number } => {
    const ring = Array.from(element.querySelectorAll('g.city'))
      .find((city) => city.querySelector('.city__letter')?.textContent?.trim() === letter)
      ?.querySelector('.city__ring') as SVGCircleElement;
    return { x: Number(ring.getAttribute('cx')), y: Number(ring.getAttribute('cy')) };
  };

  it.each([
    [1440, 826],
    [1920, 1006],
    [800, 400],
    [375, 600],
  ])('centres the whole globe in a %i x %i container, inside it', async (w, h) => {
    await render({}, w, h);
    const { cx, cy, r } = disc();

    expect(cx).toBe(w / 2);
    expect(cy).toBe(h / 2);
    expect(r).toBeLessThanOrEqual(Math.min(w, h) / 2);
    expect(svg().hasAttribute('viewBox')).toBe(false);
  });

  it('centres the globe between the panels, and fits it to the space they leave free', async () => {
    await render({ insetStart: 424, insetEnd: 200 });

    expect(disc().cx).toBe(424 + (1440 - 424 - 200) / 2);
    expect(disc().r).toBe((1440 - 424 - 200) / 2 - 22);
  });

  it('puts a route between the panels, clear of both', async () => {
    await render({ originId: 5, destinationId: 6, insetStart: 424, insetEnd: 424 });
    for (const letter of ['A', 'B']) {
      const { x, y } = pin(letter);
      expect(x).toBeGreaterThan(424);
      expect(x).toBeLessThan(1440 - 424);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(826);
    }
  });

  it('centres a route in the space the panels leave free', async () => {
    await render({ originId: 3, destinationId: 23, insetStart: 424, insetEnd: 200 });
    const a = pin('A');
    const b = pin('B');
    const middle = (a.x + b.x) / 2;
    expect(middle).toBeCloseTo(424 + (1440 - 424 - 200) / 2, 0);
  });

  it('keeps a view the user moved when the map is resized, and refits otherwise', async () => {
    await render({ originId: 3, destinationId: 23 });
    // Not touched: a new size refits the route into the new frame.
    await resize(1000, 700);
    expect(disc().cx).toBe(500);
    const fitted = zoomLevel(1000, 700);
    const a = pin('A');
    const b = pin('B');
    expect((a.x + b.x) / 2).toBeCloseTo(500, 0);

    // Zoomed out by hand, then resized: same zoom relative to the globe.
    svg().dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }));
    await settle();
    const zoomed = zoomLevel(1000, 700);
    expect(zoomed).toBeLessThan(fitted);

    await resize(1400, 700);
    expect(zoomLevel(1400, 700)).toBeCloseTo(zoomed, 6);
    expect(disc().cx).toBe(700);
  });

  it('puts the zoom buttons at the bottom right, beside the end inset', async () => {
    await render({ controls: 'bottom-end', insetEnd: 424 });
    const frame = element.querySelector('.frame') as HTMLElement;
    expect(frame.classList).toContain('frame--controls-end');
    expect(frame.style.getPropertyValue('--inset-end')).toBe('424px');
  });
});
