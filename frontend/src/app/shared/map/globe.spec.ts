import {
  DEFAULT_VIEW,
  GlobeFrame,
  GlobeView,
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  createGlobeProjection,
  fitRoute,
  globeGeometry,
  greatCircle,
  haversineKm,
  interpolateView,
  isVisible,
  maxLabelRank,
  minDotGap,
  rotateBy,
  rotateByDegrees,
} from './globe';

const BERLIN = { latitude: 52.52, longitude: 13.405 };
const VIENNA = { latitude: 48.2082, longitude: 16.3738 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };
const MADRID = { latitude: 40.4168, longitude: -3.7038 };
const FRAME: GlobeFrame = { width: 1000, height: 700, start: 0, end: 0 };

describe('isVisible', () => {
  const centre = { latitude: 50, longitude: 10 };

  it('is true for the centre and for places on the near side', () => {
    expect(isVisible(centre, centre)).toBe(true);
    expect(isVisible(BERLIN, centre)).toBe(true);
    expect(isVisible({ latitude: 0, longitude: 80 }, centre)).toBe(true);
  });

  it('is false for the far side, including the antipode', () => {
    expect(isVisible(SYDNEY, centre)).toBe(false);
    expect(isVisible({ latitude: -50, longitude: -170 }, centre)).toBe(false);
  });

  it('follows the centre: Sydney is visible once the globe is turned to it', () => {
    expect(isVisible(SYDNEY, { latitude: -30, longitude: 150 })).toBe(true);
  });

  it('switches at 90 degrees from the centre', () => {
    const equator = { latitude: 0, longitude: 0 };
    expect(isVisible({ latitude: 0, longitude: 89.9 }, equator)).toBe(true);
    expect(isVisible({ latitude: 0, longitude: 90.1 }, equator)).toBe(false);
    expect(isVisible({ latitude: 89.9, longitude: 0 }, equator)).toBe(true);
    expect(isVisible({ latitude: 90.1, longitude: 0 }, equator)).toBe(false);
  });
});

describe('maxLabelRank', () => {
  it.each([
    [1, 1],
    [2, 1],
    [2.49, 1],
    [2.5, 2],
    [4.99, 2],
    [5, 3],
    [8, 3],
  ])('at zoom %f labels up to rank %i', (zoom, rank) => {
    expect(maxLabelRank(zoom)).toBe(rank);
  });
});

describe('minDotGap', () => {
  it.each([
    [1, 36],
    [2.49, 36],
    [2.5, 22],
    [4.99, 22],
    [5, 11.25],
    [8, 11.25],
  ])('at zoom %f keeps low-ranked dots %f px from drawn cities (dot 4.5 px)', (zoom, gap) => {
    expect(minDotGap(zoom, 4.5)).toBe(gap);
  });
});

describe('clampZoom', () => {
  it('keeps the zoom between the limits', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(3)).toBe(3);
    expect(clampZoom(100)).toBe(MAX_ZOOM);
  });
});

describe('globeGeometry', () => {
  it('centres the globe in the container and fits the shorter side', () => {
    const geometry = globeGeometry(FRAME);

    expect(geometry.centerX).toBe(500);
    expect(geometry.centerY).toBe(350);
    expect(geometry.baseRadius).toBe(338); // 700 / 2 minus the margin
  });

  it('centres it in the space the panels leave free', () => {
    const geometry = globeGeometry({ ...FRAME, start: 300, end: 100 });

    expect(geometry.centerX).toBe(300 + 300);
    expect(geometry.baseRadius).toBe(288); // free width 600 / 2 minus the margin
  });
});

describe('createGlobeProjection', () => {
  const geometry = globeGeometry(FRAME);

  it('puts the centre of the view in the middle of the disc', () => {
    const projection = createGlobeProjection(
      { longitude: 13.4, latitude: 52.5, zoom: 1 },
      geometry,
    );
    const [x, y] = projection([13.4, 52.5]) as [number, number];

    expect(x).toBeCloseTo(500, 6);
    expect(y).toBeCloseTo(350, 6);
  });

  it('draws north up and east to the right', () => {
    const projection = createGlobeProjection(DEFAULT_VIEW, geometry);
    const centre = projection([10, 50]) as [number, number];
    const north = projection([10, 60]) as [number, number];
    const east = projection([20, 50]) as [number, number];

    expect(north[1]).toBeLessThan(centre[1]);
    expect(east[0]).toBeGreaterThan(centre[0]);
  });

  it('scales with the zoom', () => {
    const projection = createGlobeProjection(DEFAULT_VIEW, geometry);
    const near = projection([20, 50]) as [number, number];
    const zoomed = createGlobeProjection({ ...DEFAULT_VIEW, zoom: 2 }, geometry)([20, 50]) as [
      number,
      number,
    ];
    expect(zoomed[0] - 500).toBeCloseTo(2 * (near[0] - 500), 6);
  });
});

describe('rotateBy', () => {
  const view: GlobeView = { longitude: 10, latitude: 0, zoom: 1 };

  it('turns the surface with the pointer: dragging right moves the view west', () => {
    const turned = rotateBy(view, 100, 0, 300);

    expect(turned.longitude).toBeCloseTo(10 - (100 / 300) * (180 / Math.PI), 6);
    expect(turned.latitude).toBe(0);
  });

  it('dragging down shows more of the north, and the latitude stops at the poles', () => {
    expect(rotateBy(view, 0, 50, 300).latitude).toBeGreaterThan(0);
    expect(rotateBy({ ...view, latitude: 85 }, 0, 5000, 300).latitude).toBe(90);
    expect(rotateBy({ ...view, latitude: -85 }, 0, -5000, 300).latitude).toBe(-90);
  });

  it('keeps the longitude in -180..180 and the zoom', () => {
    const turned = rotateBy({ longitude: 175, latitude: 0, zoom: 3 }, -200, 0, 300);

    expect(turned.longitude).toBeGreaterThanOrEqual(-180);
    expect(turned.longitude).toBeLessThan(180);
    expect(turned.zoom).toBe(3);
  });

  it('turns by degrees for the keyboard', () => {
    expect(rotateByDegrees(view, 20, 5)).toEqual({ longitude: 30, latitude: 5, zoom: 1 });
    expect(rotateByDegrees({ ...view, longitude: 170 }, 20, 0).longitude).toBe(-170);
  });
});

describe('fitRoute', () => {
  it('shows Europe when there is no city', () => {
    expect(fitRoute([], FRAME, 70)).toEqual(DEFAULT_VIEW);
  });

  it('centres a single city at zoom 1', () => {
    expect(fitRoute([BERLIN], FRAME, 70)).toEqual({ ...BERLIN, zoom: 1 });
  });

  it('turns to the middle of a route and zooms until it fills the free space', () => {
    const view = fitRoute([BERLIN, VIENNA], FRAME, 70);

    expect(view.latitude).toBeGreaterThan(VIENNA.latitude);
    expect(view.latitude).toBeLessThan(BERLIN.latitude);
    expect(view.longitude).toBeGreaterThan(BERLIN.longitude);
    expect(view.longitude).toBeLessThan(VIENNA.longitude);
    expect(view.zoom).toBeGreaterThan(2);
    expect(view.zoom).toBeLessThanOrEqual(MAX_ZOOM);

    const projection = createGlobeProjection(view, globeGeometry(FRAME));
    for (const city of [BERLIN, VIENNA]) {
      const [x, y] = projection([city.longitude, city.latitude]) as [number, number];
      expect(x).toBeGreaterThanOrEqual(70 - 0.5);
      expect(x).toBeLessThanOrEqual(1000 - 70 + 0.5);
      expect(y).toBeGreaterThanOrEqual(70 - 0.5);
      expect(y).toBeLessThanOrEqual(700 - 70 + 0.5);
    }
  });

  it('zooms out further for a longer route', () => {
    const short = fitRoute([BERLIN, VIENNA], FRAME, 70).zoom;
    const long = fitRoute([MADRID, SYDNEY], FRAME, 70);

    expect(long.zoom).toBeLessThan(short);
    expect(long.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  it('centres the route in the space the panels leave free', () => {
    const frame = { ...FRAME, start: 300, end: 100 };
    const view = fitRoute([BERLIN, VIENNA], frame, 70);
    const projection = createGlobeProjection(view, globeGeometry(frame));
    const [ax] = projection([BERLIN.longitude, BERLIN.latitude]) as [number, number];
    const [bx] = projection([VIENNA.longitude, VIENNA.latitude]) as [number, number];

    expect((ax + bx) / 2).toBeCloseTo(300 + 300, 0);
  });

  it('stays at zoom 1 when the cities are the same place', () => {
    expect(fitRoute([BERLIN, BERLIN], FRAME, 70).zoom).toBe(1);
  });
});

describe('interpolateView', () => {
  const from: GlobeView = { longitude: -170, latitude: 10, zoom: 1 };
  const to: GlobeView = { longitude: 170, latitude: 10, zoom: 4 };

  it('starts and ends at the two views', () => {
    const start = interpolateView(from, to, 0);
    const end = interpolateView(from, to, 1);

    expect(start.longitude).toBeCloseTo(-170, 6);
    expect(end.longitude).toBeCloseTo(170, 6);
    expect(end.zoom).toBeCloseTo(4, 6);
  });

  it('turns the short way round the globe and zooms in equal factors', () => {
    const middle = interpolateView(from, to, 0.5);

    expect(Math.abs(middle.longitude)).toBeGreaterThan(175);
    expect(middle.zoom).toBeCloseTo(2, 6);
  });
});

describe('greatCircle', () => {
  it('samples from one city to the other along the shortest path', () => {
    const arc = greatCircle(BERLIN, SYDNEY);

    expect(arc[0][0]).toBeCloseTo(BERLIN.longitude, 6);
    expect(arc[0][1]).toBeCloseTo(BERLIN.latitude, 6);
    expect(arc[arc.length - 1][0]).toBeCloseTo(SYDNEY.longitude, 6);
    expect(arc[arc.length - 1][1]).toBeCloseTo(SYDNEY.latitude, 6);
    expect(arc.length).toBeGreaterThan(40);
    expect(Math.max(...arc.map((p) => p[1]))).toBeGreaterThan(BERLIN.latitude);
  });

  it('has at least a few samples for a short leg', () => {
    expect(greatCircle(BERLIN, VIENNA).length).toBeGreaterThanOrEqual(3);
  });
});

describe('haversineKm', () => {
  it('measures Berlin to Vienna as the API does', () => {
    expect(haversineKm(BERLIN, VIENNA)).toBeCloseTo(523.6, 0);
  });

  it('is zero for the same place and symmetric', () => {
    expect(haversineKm(BERLIN, BERLIN)).toBe(0);
    expect(haversineKm(VIENNA, BERLIN)).toBeCloseTo(haversineKm(BERLIN, VIENNA), 6);
  });
});
