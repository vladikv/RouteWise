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

  it('interpolates between two views', () => {
    expect(interpolateView(BASE, { x: 100, y: 100, width: 320, height: 310 }, 0.5)).toEqual({
      x: 50,
      y: 50,
      width: 480,
      height: 465,
    });
  });
});
