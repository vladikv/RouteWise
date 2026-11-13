import { ComponentFixture, TestBed } from '@angular/core/testing';
import { City } from '../../core/api/models';
import { RouteMap } from './route-map';

const CITIES: City[] = [
  { id: 3, name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405 },
  { id: 23, name: 'Vienna', country: 'AT', latitude: 48.2082, longitude: 16.3738 },
  { id: 18, name: 'Paris', country: 'FR', latitude: 48.8566, longitude: 2.3522 },
  { id: 5, name: 'Lisbon', country: 'PT', latitude: 38.7223, longitude: -9.1393 },
  { id: 6, name: 'Stockholm', country: 'SE', latitude: 59.3293, longitude: 18.0686 },
];

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
  const viewBox = (): number[] => (svg().getAttribute('viewBox') ?? '').split(' ').map(Number);
  const pin = (letter: string): { x: number; y: number } => {
    const [x, y, width, height] = viewBox();
    const ring = Array.from(element.querySelectorAll('g.city'))
      .find((city) => city.querySelector('.city__letter')?.textContent?.trim() === letter)
      ?.querySelector('.city__ring') as SVGCircleElement;
    return {
      x: ((Number(ring.getAttribute('cx')) - x) / width) * size.width,
      y: ((Number(ring.getAttribute('cy')) - y) / height) * size.height,
    };
  };

  it.each([
    [1440, 826],
    [1920, 1006],
    [2560, 1366],
    [800, 400],
    [375, 600],
  ])('takes the aspect ratio of a %i x %i container, so there is no letterbox', async (w, h) => {
    await render({}, w, h);
    const [, , width, height] = viewBox();
    expect(width / height).toBeCloseTo(w / h, 3);
    expect(element.querySelector('.fades')).toBeNull();
  });

  it('shows no edge of the land data at rest, and fades it into the sea only past it', async () => {
    await render({ insetStart: 424, insetEnd: 424 });
    expect(element.querySelector('.fades')).toBeNull();

    svg().dispatchEvent(new WheelEvent('wheel', { deltaY: 3000, bubbles: true, cancelable: true }));
    await settle();
    expect(element.querySelector('.fades')).not.toBeNull();
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
    const [fx, fy, fw, fh] = viewBox();
    expect(fw / fh).toBeCloseTo(1000 / 700, 3);
    const refitCentre = { x: fx + fw / 2, y: fy + fh / 2 };

    // Zoomed out by hand, then resized: same centre, same zoom relative to the whole map.
    // Zoomed out around the middle of the map, so the centre stays where it was.
    svg().dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: 300,
        clientX: 500,
        clientY: 350,
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const [mx, my, mw, mh] = viewBox();
    const centre = { x: mx + mw / 2, y: my + mh / 2 };
    expect(mw).toBeGreaterThan(fw);
    expect(centre.x).toBeCloseTo(refitCentre.x, 3);
    expect(centre.y).toBeCloseTo(refitCentre.y, 3);

    await resize(1400, 700);
    const [rx, ry, rw, rh] = viewBox();
    expect(rw / rh).toBeCloseTo(1400 / 700, 3);
    expect(rx + rw / 2).toBeCloseTo(centre.x, 3);
    expect(ry + rh / 2).toBeCloseTo(centre.y, 3);
  });

  it('puts the zoom buttons at the bottom right, beside the end inset', async () => {
    await render({ controls: 'bottom-end', insetEnd: 424 });
    const frame = element.querySelector('.frame') as HTMLElement;
    expect(frame.classList).toContain('frame--controls-end');
    expect(frame.style.getPropertyValue('--inset-end')).toBe('424px');
  });
});
