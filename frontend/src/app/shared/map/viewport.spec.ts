import { View, clampView, fitPoints, interpolateView, panBy, zoomAt, zoomOf } from './viewport';

const BASE: View = { x: 0, y: 0, width: 640, height: 620 };

describe('viewport', () => {
  it('measures zoom against the base drawing', () => {
    expect(zoomOf(BASE, BASE)).toBe(1);
    expect(zoomOf({ x: 0, y: 0, width: 320, height: 310 }, BASE)).toBe(2);
  });

  it('keeps the zoom between 1× and 6× and the view inside the drawing', () => {
    // 640 / 64 = 10× → capped at 6×: width 640 / 6 = 106.67, height 620 / 6 = 103.33,
    // centred where the requested view was centred (320, 310).
    const capped = clampView({ x: 288, y: 279, width: 64, height: 62 }, BASE);
    expect(capped.width).toBeCloseTo(106.67, 2);
    expect(capped.height).toBeCloseTo(103.33, 2);
    expect(capped.x + capped.width / 2).toBeCloseTo(320, 6);

    expect(clampView({ x: -100, y: -100, width: 1280, height: 1240 }, BASE)).toEqual(BASE);
    expect(clampView({ x: -50, y: -50, width: 320, height: 310 }, BASE)).toEqual({
      x: 0,
      y: 0,
      width: 320,
      height: 310,
    });
  });

  it('zooms around an anchor that stays in place', () => {
    expect(zoomAt(BASE, BASE, 2, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, width: 320, height: 310 });
    // Anchor at the centre: (320 - 320 * 0.5, 310 - 310 * 0.5) = (160, 155).
    expect(zoomAt(BASE, BASE, 2, { x: 320, y: 310 })).toEqual({
      x: 160,
      y: 155,
      width: 320,
      height: 310,
    });
  });

  it('pans by a distance and stops at the edges', () => {
    const view = { x: 160, y: 155, width: 320, height: 310 };
    expect(panBy(view, BASE, 10, -20)).toEqual({ x: 170, y: 135, width: 320, height: 310 });
    // The largest x is 640 - 320 = 320.
    expect(panBy(view, BASE, 500, 0).x).toBe(320);
  });

  it('fits points with a margin, as close as the maximum zoom allows', () => {
    // Box 90..210 × 90..160 = 120 × 70; zoom = min(640 / 120, 620 / 70) = 5.333;
    // view 120 × 116.25 centred on (150, 125): x = 90, y = 125 - 58.125 = 66.875.
    const view = fitPoints(
      [
        { x: 100, y: 100 },
        { x: 200, y: 150 },
      ],
      BASE,
      10,
    );
    expect(view.x).toBeCloseTo(90, 6);
    expect(view.y).toBeCloseTo(66.875, 6);
    expect(view.width).toBeCloseTo(120, 6);
    expect(view.height).toBeCloseTo(116.25, 6);

    expect(zoomOf(fitPoints([{ x: 100, y: 100 }], BASE, 0), BASE)).toBeCloseTo(6, 6);
    expect(fitPoints([], BASE, 10)).toEqual(BASE);
  });

  it('keeps the view inside separate bounds that are larger than the base', () => {
    const bounds = { x: -100, y: -50, width: 840, height: 720 };
    const view = { x: 160, y: 155, width: 320, height: 310 };
    // Panning may go past the base, up to the bounds.
    expect(panBy(view, BASE, -500, -500, bounds)).toEqual({
      x: -100,
      y: -50,
      width: 320,
      height: 310,
    });
    expect(panBy(view, BASE, 900, 900, bounds)).toEqual({
      x: 420,
      y: 360,
      width: 320,
      height: 310,
    });
    expect(zoomAt(BASE, BASE, 2, { x: 0, y: 0 }, bounds).width).toBe(320);
  });

  it('fits points into the area the panels leave free', () => {
    // Container 1000 × 500 px showing the 640 × 320 base (0.64 units per pixel).
    const base = { x: 0, y: 0, width: 640, height: 320 };
    const points = [
      { x: 300, y: 150 },
      { x: 340, y: 170 },
    ];
    const bounds = { x: -1000, y: -1000, width: 3000, height: 3000 };
    const frame = { width: 1000, height: 500, start: 400, end: 100 };
    const view = fitPoints(points, base, 0, frame, bounds);

    // The view keeps the container's aspect ratio.
    expect(view.width / view.height).toBeCloseTo(2, 6);
    // Free area 500 px wide: 40 units / 500 px = 0.08 units per pixel, a 12.5 times zoom;
    // clamped to the maximum zoom of 6 (0.1067 units per pixel).
    expect(zoomOf(view, base)).toBeCloseTo(6, 6);
    // The route's centre (320, 160) sits in the middle of the free area: x = 400 + 250 = 650 px.
    const unit = view.width / frame.width;
    expect(view.x + 650 * unit).toBeCloseTo(320, 6);
    expect(view.y + 250 * unit).toBeCloseTo(160, 6);
  });

  it('zooms out far enough that a wide route clears both panels', () => {
    const base = { x: 0, y: 0, width: 2000, height: 1000 };
    const bounds = { x: -500, y: -500, width: 3000, height: 2000 };
    const frame = { width: 1000, height: 500, start: 300, end: 300 };
    const points = [
      { x: 200, y: 250 },
      { x: 700, y: 250 },
    ];
    const view = fitPoints(points, base, 40, frame, bounds);
    const unit = view.width / frame.width;
    // The margin of 40 units is 20 px at this scale: the free area is 400 px minus 20 px on each side.
    expect(unit).toBeCloseTo(500 / 360, 6);
    // Both ends stay between the panels.
    expect((200 - view.x) / unit).toBeGreaterThanOrEqual(300 + 20 - 0.001);
    expect((700 - view.x) / unit).toBeLessThanOrEqual(700 - 20 + 0.001);
  });

  it('interpolates between two views', () => {
    expect(interpolateView(BASE, { x: 100, y: 100, width: 320, height: 310 }, 0.5)).toEqual({
      x: 50,
      y: 50,
      width: 480,
      height: 465,
    });
  });
});
