import { createProjection, haversineKm, routeArc } from './projection';

const BERLIN = { latitude: 52.52, longitude: 13.405 };
const VIENNA = { latitude: 48.2082, longitude: 16.3738 };

describe('createProjection', () => {
  it('fits points into the padded box with north up and east right', () => {
    // Two points 10° of longitude apart on the equator side by side with a point further north.
    const southWest = { latitude: 0, longitude: 0 };
    const northEast = { latitude: 10, longitude: 10 };
    const project = createProjection([southWest, northEast], 120, 120, 10);

    const a = project(southWest);
    const b = project(northEast);

    // Mercator spans: x = 10° = 0.17453 rad; y = ln(tan(50°)) = 0.17543. The taller span
    // (y) fills the inner height of 100, so scale = 100 / 0.17543 = 570.0 and the x span
    // covers 0.17453 * 570.0 = 99.5, centred with (100 - 99.5) / 2 = 0.26 on each side.
    expect(a.y).toBeCloseTo(110, 1);
    expect(b.y).toBeCloseTo(10, 1);
    expect(a.x).toBeCloseTo(10.26, 1);
    expect(b.x).toBeCloseTo(109.74, 1);
  });

  it('places Vienna south-east of Berlin', () => {
    const project = createProjection([BERLIN, VIENNA], 200, 200, 20);

    expect(project(VIENNA).x).toBeGreaterThan(project(BERLIN).x);
    expect(project(VIENNA).y).toBeGreaterThan(project(BERLIN).y);
  });

  it('maps everything to the centre when there is nothing to spread out', () => {
    expect(createProjection([], 200, 100, 10)(BERLIN)).toEqual({ x: 100, y: 50 });
    expect(createProjection([BERLIN], 200, 100, 10)(BERLIN)).toEqual({ x: 100, y: 50 });
  });
});

describe('haversineKm', () => {
  it('matches the known Berlin–Vienna distance', () => {
    // The API reports 523.6 km for this pair with the same formula.
    expect(haversineKm(BERLIN, VIENNA)).toBeCloseTo(523.6, 0);
  });

  it('is zero for the same point and symmetric', () => {
    expect(haversineKm(BERLIN, BERLIN)).toBe(0);
    expect(haversineKm(VIENNA, BERLIN)).toBeCloseTo(haversineKm(BERLIN, VIENNA), 6);
  });
});

describe('routeArc', () => {
  it('draws a quadratic curve bulging perpendicular to the line', () => {
    // From (0,0) to (100,0): midpoint (50,0); control = (50 - 0*0.2, 0 + 100*0.2) = (50,20).
    expect(routeArc({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.2)).toBe('M 0 0 Q 50 20 100 0');
  });
});
