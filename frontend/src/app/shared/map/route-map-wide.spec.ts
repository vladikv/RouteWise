import { TestBed } from '@angular/core/testing';
import { City } from '../../core/api/models';
import { RouteMap } from './route-map';

const CITIES: City[] = [
  { id: 3, name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405 },
  { id: 23, name: 'Vienna', country: 'AT', latitude: 48.2082, longitude: 16.3738 },
  { id: 18, name: 'Paris', country: 'FR', latitude: 48.8566, longitude: 2.3522 },
];

/** The map measures its rendered width; tests fake it, since jsdom has no layout. */
async function renderAt(width: number, wide: boolean): Promise<SVGSVGElement> {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height: 600,
    top: 0,
    left: 0,
    right: width,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const fixture = TestBed.createComponent(RouteMap);
  fixture.componentRef.setInput('cities', CITIES);
  fixture.componentRef.setInput('wide', wide);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGSVGElement;
}

function viewBox(svg: SVGSVGElement): number[] {
  return (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
}

describe('RouteMap wide mode', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a landscape view of the whole land outline when wide and at least 720 px', async () => {
    const svg = await renderAt(1000, true);
    const [, , width, height] = viewBox(svg);

    expect(width / height).toBeGreaterThan(1.3);
    expect(svg.classList).toContain('map--wide');
    expect(svg.style.aspectRatio.replace(/\s/g, '')).toBe(`${width}/${height}`);
  });

  it('keeps the near-square view on narrow screens', async () => {
    const [, , width, height] = viewBox(await renderAt(500, true));

    expect(width).toBe(640);
    expect(height).toBe(620);
  });

  it('keeps the near-square view without the wide input, at any width', async () => {
    const svg = await renderAt(1000, false);
    const [, , width, height] = viewBox(svg);

    expect([width, height]).toEqual([640, 620]);
    expect(svg.classList).not.toContain('map--wide');
  });
});
