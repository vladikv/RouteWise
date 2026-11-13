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
 * Keeps `view` inside `bounds` (the base drawing unless given) and its zoom, measured against
 * `base`, within {@link MIN_ZOOM}–{@link MAX_ZOOM}, preserving the base aspect ratio.
 */
export function clampView(view: View, base: View, bounds: View = base): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomOf(view, base)));
  const width = base.width / zoom;
  const height = base.height / zoom;
  const centerX = view.x + view.width / 2;
  const centerY = view.y + view.height / 2;
  return {
    x: clamp(centerX - width / 2, bounds.x, bounds.x + bounds.width - width),
    y: clamp(centerY - height / 2, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

/**
 * Zooms by `factor` (> 1 zooms in) keeping `anchor` (drawing coordinates) at the
 * same place on screen, as a pointer-centred zoom does.
 */
export function zoomAt(
  view: View,
  base: View,
  factor: number,
  anchor: MapPoint,
  bounds: View = base,
): View {
  const target = clampView(
    { x: view.x, y: view.y, width: view.width / factor, height: view.height / factor },
    base,
    bounds,
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
    bounds,
  );
}

/** Moves the view by a distance in drawing units (positive dx moves the content left). */
export function panBy(view: View, base: View, dx: number, dy: number, bounds: View = base): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, base, bounds);
}

/**
 * The part of the container (CSS pixels) that is free of floating panels: `start` and `end`
 * are the widths covered at the left and right. `width`/`height` are the container's size.
 */
export interface FitFrame {
  width: number;
  height: number;
  start: number;
  end: number;
}

/**
 * The view that shows all `points` with `margin` (drawing units) around them,
 * as close as {@link MAX_ZOOM} allows. With no points it is the base view.
 * With a `frame` the points are centred in the part of the container the panels leave free
 * (the view has the container's aspect ratio, as in a fill map), so none ends up under a panel.
 */
export function fitPoints(
  points: MapPoint[],
  base: View,
  margin: number,
  frame?: FitFrame,
  bounds: View = base,
): View {
  if (points.length === 0) {
    return { ...base };
  }
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  if (!frame) {
    const zoom = Math.min(
      base.width / (maxX - minX + 2 * margin),
      base.height / (maxY - minY + 2 * margin),
    );
    const width = base.width / zoom;
    const height = base.height / zoom;
    return clampView(
      {
        x: (minX + maxX) / 2 - width / 2,
        y: (minY + maxY) / 2 - height / 2,
        width,
        height,
      },
      base,
      bounds,
    );
  }
  const baseUnit = base.width / frame.width;
  const freeWidth = Math.max(frame.width - frame.start - frame.end - (2 * margin) / baseUnit, 1);
  const freeHeight = Math.max(frame.height - (2 * margin) / baseUnit, 1);
  const unit = clamp(
    Math.max((maxX - minX) / freeWidth, (maxY - minY) / freeHeight),
    baseUnit / MAX_ZOOM,
    baseUnit,
  );
  const freeCenter = frame.start + (frame.width - frame.start - frame.end) / 2;
  return clampView(
    {
      x: (minX + maxX) / 2 - unit * freeCenter,
      y: (minY + maxY) / 2 - (unit * frame.height) / 2,
      width: unit * frame.width,
      height: unit * frame.height,
    },
    base,
    bounds,
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

/** Keeps `value` between `min` and `max`; when `max` is below `min` the range is the other way round. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max));
}
