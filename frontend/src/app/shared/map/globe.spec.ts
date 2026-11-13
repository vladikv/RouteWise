import {
  DEFAULT_VIEW,
  GlobeFrame,
  GlobeGeometry,
  GlobeView,
  IDLE_TURN_MS,
  MAX_ZOOM,
  MIN_ZOOM,
  arcPeak,
  arcPrefix,
  arcSamples,
  arcSegments,
  clampZoom,
  createGlobeProjection,
  fitRoute,
  globeGeometry,
  haversineKm,
  idleTurn,
  interpolateView,
  isVisible,
  maxLabelRank,
  minDotGap,
  projectLifted,
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
    expect(geometry.baseRadius).toBe(328); // 700 / 2 minus the 22 px margin
  });

  it('centres it in the space the panels leave free', () => {
    const geometry = globeGeometry({ ...FRAME, start: 300, end: 100 });

    expect(geometry.centerX).toBe(300 + 300);
    expect(geometry.baseRadius).toBe(278); // free width 600 / 2 minus the margin
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

  it('keeps the whole arc, apex included, inside the margin', () => {
    const view = fitRoute([BERLIN, VIENNA], FRAME, 70);
    const geometry = globeGeometry(FRAME);

    const points = arcSegments(arcSamples(BERLIN, VIENNA), view, geometry).flat();

    expect(points).toHaveLength(49);
    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(70 - 1);
      expect(x).toBeLessThanOrEqual(1000 - 70 + 1);
      expect(y).toBeGreaterThanOrEqual(70 - 1);
      expect(y).toBeLessThanOrEqual(700 - 70 + 1);
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

describe('idleTurn', () => {
  const view: GlobeView = { longitude: 10, latitude: 50, zoom: 2 };

  it('makes one full turn in two minutes, to the east, keeping latitude and zoom', () => {
    expect(IDLE_TURN_MS).toBe(120_000);
    const turned = idleTurn(view, 100);

    expect(turned.longitude).toBeCloseTo(10 - 0.3, 9);
    expect(turned.latitude).toBe(50);
    expect(turned.zoom).toBe(2);
  });

  it('wraps the longitude into -180 to 180', () => {
    expect(idleTurn({ ...view, longitude: -179.9 }, 100).longitude).toBeGreaterThan(170);
  });

  it('counts a long gap between frames (a throttled tab) as a short step', () => {
    expect(idleTurn(view, 60_000).longitude).toBeCloseTo(idleTurn(view, 250).longitude, 9);
    expect(idleTurn(view, -5).longitude).toBe(10);
  });
});

describe('arcPeak', () => {
  it('is proportional to the angle of the leg, between a minimum and a maximum', () => {
    expect(arcPeak(0)).toBe(0);
    expect(arcPeak(0.01)).toBe(0.01);
    expect(arcPeak(0.0822)).toBeCloseTo(0.0206, 3); // Berlin to Vienna
    expect(arcPeak(0.4)).toBeCloseTo(0.1, 6);
    expect(arcPeak(1.7)).toBe(0.15); // across an ocean
  });
});

describe('projectLifted', () => {
  // The disc: centre (100, 100), radius 50, looking at 0 E, 0 N.
  const geometry: GlobeGeometry = { centerX: 100, centerY: 100, baseRadius: 50 };
  const view: GlobeView = { longitude: 0, latitude: 0, zoom: 1 };
  const at = (longitude: number, latitude: number, lift: number, v = view) =>
    projectLifted({ longitude, latitude }, lift, v, geometry);

  it('leaves a point on the surface where the projection puts it', () => {
    const surface = at(30, 20, 0);
    const [x, y] = createGlobeProjection(view, geometry)([30, 20]) as [number, number];

    expect(surface.x).toBeCloseTo(x, 6);
    expect(surface.y).toBeCloseTo(y, 6);
    expect(surface.hidden).toBe(false);
  });

  it('lifts the middle of the disc straight up the screen by the lift times the radius', () => {
    const lifted = at(0, 0, 0.2);

    expect(lifted.x).toBeCloseTo(100, 6);
    expect(lifted.y).toBeCloseTo(90, 6); // 50 * 0.2 above the centre
    expect(lifted.hidden).toBe(false);
  });

  it('moves a point at the edge outwards by the lift', () => {
    const east = at(90, 0, 0.2);
    const north = at(0, 90, 0.1);

    expect(east.x).toBeCloseTo(160, 6); // 100 + 50 * 1.2
    expect(east.y).toBeCloseTo(100, 6);
    expect(north.x).toBeCloseTo(100, 6);
    expect(north.y).toBeCloseTo(45, 6); // 100 - 50 * 1.1
  });

  it('scales with the zoom around the middle of the disc', () => {
    const lifted = at(0, 0, 0.2, { ...view, zoom: 2 });

    expect(lifted.y).toBeCloseTo(80, 6); // 100 - 100 * 0.2
  });

  it('hides a far-side point inside the disc', () => {
    expect(at(180, 0, 0.1).hidden).toBe(true);
    expect(at(120, 0, 0).hidden).toBe(true); // 43.3 px from the middle
  });

  it('shows a far-side point that is lifted clear of the edge of the disc', () => {
    const lifted = at(120, 0, 0.2);

    expect(lifted.x).toBeCloseTo(151.96, 2);
    expect(lifted.y).toBeCloseTo(105, 6);
    expect(Math.hypot(lifted.x - 100, lifted.y - 100)).toBeGreaterThan(50);
    expect(lifted.hidden).toBe(false);
  });
});

describe('arcSamples', () => {
  const arc = arcSamples(BERLIN, VIENNA);

  it('follows the great circle from one city to the other, at least 48 steps', () => {
    expect(arc).toHaveLength(49);
    expect(arc[0].longitude).toBeCloseTo(BERLIN.longitude, 6);
    expect(arc[0].latitude).toBeCloseTo(BERLIN.latitude, 6);
    expect(arc[48].longitude).toBeCloseTo(VIENNA.longitude, 6);
    expect(arc[48].latitude).toBeCloseTo(VIENNA.latitude, 6);
  });

  it('lifts nothing at the ends and the arc peak in the middle', () => {
    expect(arc[0].lift).toBe(0);
    expect(arc[48].lift).toBeCloseTo(0, 12);
    expect(arc[24].lift).toBeCloseTo(0.0206, 3);
    expect(Math.max(...arc.map((sample) => sample.lift))).toBeCloseTo(arc[24].lift, 12);
  });

  it('has a prefix up to a fraction, ending exactly at it', () => {
    const half = arcPrefix(arc, 0.5);

    expect(half).toHaveLength(25);
    expect(half[24].longitude).toBeCloseTo(arc[24].longitude, 9);
    expect(half[24].lift).toBeCloseTo(arc[24].lift, 12);
    expect(arcPrefix(arc, 0)).toHaveLength(1);
    expect(arcPrefix(arc, 1)).toHaveLength(49);

    const between = arcPrefix(arc, 0.5 + 1 / 96); // half way between samples 24 and 25
    expect(between).toHaveLength(26);
    expect(between[25].longitude).toBeCloseTo((arc[24].longitude + arc[25].longitude) / 2, 9);
    expect(between[25].lift).toBeCloseTo((arc[24].lift + arc[25].lift) / 2, 12);
  });

  it('samples a long leg every 2 degrees and caps its lift', () => {
    const long = arcSamples(BERLIN, SYDNEY);

    expect(long.length).toBeGreaterThan(48);
    expect(Math.max(...long.map((sample) => sample.lift))).toBeCloseTo(0.15, 3);
  });
});

describe('arcSegments', () => {
  const geometry: GlobeGeometry = { centerX: 500, centerY: 500, baseRadius: 1000 };
  const europe: GlobeView = { longitude: 15, latitude: 50, zoom: 1 };

  it('draws a leg on the near side as one piece that starts and ends at the cities', () => {
    const [segment, ...others] = arcSegments(arcSamples(BERLIN, VIENNA), europe, geometry);
    const projection = createGlobeProjection(europe, geometry);
    const [ax, ay] = projection([BERLIN.longitude, BERLIN.latitude]) as [number, number];
    const [bx, by] = projection([VIENNA.longitude, VIENNA.latitude]) as [number, number];

    expect(others).toHaveLength(0);
    expect(segment).toHaveLength(49);
    expect(segment[0].x).toBeCloseTo(ax, 6);
    expect(segment[0].y).toBeCloseTo(ay, 6);
    expect(segment[48].x).toBeCloseTo(bx, 6);
    expect(segment[48].y).toBeCloseTo(by, 6);
  });

  it('lifts the middle of the arc about 21 px above its great-circle path on a 1000 px globe', () => {
    const [segment] = arcSegments(arcSamples(BERLIN, VIENNA), europe, geometry);
    const middle = arcSamples(BERLIN, VIENNA)[24];
    const [x, y] = createGlobeProjection(europe, geometry)([middle.longitude, middle.latitude]) as [
      number,
      number,
    ];

    expect(segment[24].x).toBeCloseTo(x, 0);
    expect(y - segment[24].y).toBeGreaterThan(20);
    expect(y - segment[24].y).toBeLessThan(21.25);
  });

  it('cuts off the part behind the globe, keeping what is lifted clear of the edge', () => {
    const centre: GlobeView = { longitude: 0, latitude: 0, zoom: 1 };
    const small: GlobeGeometry = { centerX: 100, centerY: 100, baseRadius: 50 };
    const all = arcSamples({ longitude: 120, latitude: 0 }, { longitude: 0, latitude: 0 });

    const [segment, ...others] = arcSegments(all, centre, small);

    expect(others).toHaveLength(0);
    expect(segment.length).toBeGreaterThan(30);
    expect(segment.length).toBeLessThan(all.length - 3);
    expect(segment[segment.length - 1].x).toBeCloseTo(100, 6);
    expect(segment[segment.length - 1].y).toBeCloseTo(100, 6);
    expect(segment[0].x).toBeGreaterThan(145); // starts out beyond the edge, not at the city
  });

  it('draws nothing for a leg entirely behind the globe', () => {
    const centre: GlobeView = { longitude: 0, latitude: 0, zoom: 1 };
    const small: GlobeGeometry = { centerX: 100, centerY: 100, baseRadius: 50 };

    expect(
      arcSegments(
        arcSamples({ longitude: 150, latitude: 0 }, { longitude: 170, latitude: 0 }),
        centre,
        small,
      ),
    ).toEqual([]);
  });

  it('draws only the part up to the fraction', () => {
    const [segment] = arcSegments(arcPrefix(arcSamples(BERLIN, VIENNA), 0.5), europe, geometry);

    expect(segment).toHaveLength(25);
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
