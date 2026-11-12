/** Pure zoom and pan maths for an SVG viewBox. */

import { MapPoint } from './projection';

export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

/** How many times the base drawing is magnified by `view`. */
export function zoomOf(view: View, base: View): number {
  return base.width / view.width;
}

/**
 * Keeps `view` inside the base drawing and its zoom within {@link MIN_ZOOM}–{@link MAX_ZOOM},
 * preserving the base aspect ratio.
 */
export function clampView(view: View, base: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomOf(view, base)));
  const width = base.width / zoom;
  const height = base.height / zoom;
  const centerX = view.x + view.width / 2;
  const centerY = view.y + view.height / 2;
  return {
    x: clamp(centerX - width / 2, base.x, base.x + base.width - width),
    y: clamp(centerY - height / 2, base.y, base.y + base.height - height),
    width,
    height,
  };
}

/**
 * Zooms by `factor` (> 1 zooms in) keeping `anchor` (drawing coordinates) at the
 * same place on screen, as a pointer-centred zoom does.
 */
export function zoomAt(view: View, base: View, factor: number, anchor: MapPoint): View {
  const target = clampView(
    { x: view.x, y: view.y, width: view.width / factor, height: view.height / factor },
    base,
  );
  const scale = target.width / view.width;
  return clampView(
    {
      x: anchor.x - (anchor.x - view.x) * scale,
      y: anchor.y - (anchor.y - view.y) * scale,
      width: target.width,
      height: target.height,
    },
    base,
  );
}

/** Moves the view by a distance in drawing units (positive dx moves the content left). */
export function panBy(view: View, base: View, dx: number, dy: number): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, base);
}

/**
 * The view that shows all `points` with `margin` (drawing units) around them,
 * as close as {@link MAX_ZOOM} allows. With no points it is the base view.
 */
export function fitPoints(points: MapPoint[], base: View, margin: number): View {
  if (points.length === 0) {
    return { ...base };
  }
  const minX = Math.min(...points.map((p) => p.x)) - margin;
  const maxX = Math.max(...points.map((p) => p.x)) + margin;
  const minY = Math.min(...points.map((p) => p.y)) - margin;
  const maxY = Math.max(...points.map((p) => p.y)) + margin;
  const zoom = Math.min(base.width / (maxX - minX), base.height / (maxY - minY));
  const width = base.width / zoom;
  const height = base.height / zoom;
  return clampView(
    { x: (minX + maxX) / 2 - width / 2, y: (minY + maxY) / 2 - height / 2, width, height },
    base,
  );
}

/** Linear interpolation between two views, `t` from 0 to 1 (for animated transitions). */
export function interpolateView(from: View, to: View, t: number): View {
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    x: mix(from.x, to.x),
    y: mix(from.y, to.y),
    width: mix(from.width, to.width),
    height: mix(from.height, to.height),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
