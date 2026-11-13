import { TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { RouteMap } from './route-map';

const CITIES = [
  { id: 3, name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405 },
  { id: 23, name: 'Vienna', country: 'AT', latitude: 48.2082, longitude: 16.3738 },
  { id: 18, name: 'Paris', country: 'FR', latitude: 48.8566, longitude: 2.3522 },
].map((city) => makeCity(city));

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

describe('RouteMap wide mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('takes a landscape shape when wide and at least 720 px', async () => {
    const svg = await renderAt(1000, true);

    expect(svg.classList).toContain('map--wide');
    expect(svg.style.aspectRatio.replace(/\s/g, '')).toBe('16/9');
  });

  it('keeps the near-square shape on narrow screens', async () => {
    const svg = await renderAt(500, true);

    expect(svg.classList).not.toContain('map--wide');
    expect(svg.style.aspectRatio.replace(/\s/g, '')).toBe('640/620');
  });

  it('keeps the near-square shape without the wide input, at any width', async () => {
    const svg = await renderAt(1000, false);

    expect(svg.style.aspectRatio.replace(/\s/g, '')).toBe('640/620');
    expect(svg.classList).not.toContain('map--wide');
  });

  it('centres the globe in the measured drawing', async () => {
    const svg = await renderAt(1000, true);

    expect(svg.querySelector('circle.sea')?.getAttribute('cx')).toBe('500');
    expect(svg.querySelector('circle.sea')?.getAttribute('cy')).toBe('300');
  });
});
