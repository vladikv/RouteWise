/** Pure globe maths: orthographic projection, visibility, rotation, route fit, great-circle paths and lifted arcs. */

import { GeoProjection, geoCentroid, geoDistance, geoInterpolate, geoOrthographic } from 'd3-geo';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

/** The part of the globe facing the viewer: the point in the middle of the disc, and the magnification. */
export interface GlobeView extends GeoPoint {
  /** Times the radius of the globe fitted into the free space (see {@link globeGeometry}). */
  zoom: number;
}

/**
 * The container in CSS pixels. `start` and `end` are the widths at the left and right covered by
 * floating panels; the globe is centred in the space they leave free.
 */
export interface GlobeFrame {
  width: number;
  height: number;
  start: number;
  end: number;
}

export interface GlobeGeometry {
  centerX: number;
  centerY: number;
  /** Radius in pixels at zoom 1. */
  baseRadius: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** Where the globe points when no city is selected: Europe. */
export const DEFAULT_VIEW: GlobeView = { longitude: 10, latitude: 50, zoom: 1 };

/** Space kept between the globe at zoom 1 and the edge of the free space, in CSS pixels. */
const GLOBE_MARGIN = 22;
const MIN_RADIUS = 40;
const MIN_FREE_WIDTH = 240;
const EARTH_RADIUS_KM = 6371;
/** Latitude cosines below this are not used to scale a horizontal drag (it would spin at the poles). */
const MIN_COSINE = 0.15;
const FIT_ITERATIONS = 3;
/** A globe at rest turns once round in this long. */
export const IDLE_TURN_MS = 120_000;
/** A frame longer than this (a throttled tab) advances the idle turn by no more than this. */
const IDLE_MAX_STEP_MS = 250;
/** One sample per this many degrees along a great-circle arc. */
const ARC_STEP_DEGREES = 2;

/**
 * A lifted arc: the leg's great-circle path drawn above the surface. Its peak height is
 * `ARC_LIFT_PER_RADIAN` times the leg's angular length as a fraction of the globe radius, kept
 * between `ARC_LIFT_MIN` and `ARC_LIFT_MAX` (Berlin to Vienna, 0.082 rad: 0.021; across an ocean: 0.15).
 */
export const ARC_LIFT_PER_RADIAN = 0.25;
export const ARC_LIFT_MIN = 0.01;
export const ARC_LIFT_MAX = 0.15;
/** A lifted point also moves up the screen by this many times its lift (the globe is seen a little from the side). */
export const ARC_LIFT_TILT = 1;
/** An arc is sampled at least this many times, so the lifted curve stays smooth. */
const ARC_MIN_STEPS = 48;
/** Samples per leg used to find the extent of its arc (see {@link fitRoute}). */
const ARC_FIT_SAMPLES = 12;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Great-circle ("straight-line") distance in km; the same formula as the API uses. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** True when `point` is on the visible half of the globe whose disc is centred on `rotation`. */
export function isVisible(point: GeoPoint, rotation: GeoPoint): boolean {
  return (
    geoDistance([point.longitude, point.latitude], [rotation.longitude, rotation.latitude]) <
    Math.PI / 2
  );
}

/**
 * The highest label rank (1 = most important) shown at this zoom: rank 1 up to 2.5x, rank 2 from
 * 2.5x, rank 3 from 5x. Stricter at low zoom so dense areas such as Europe stay readable.
 */
export function maxLabelRank(zoom: number): number {
  if (zoom >= 5) {
    return 3;
  }
  return zoom >= 2.5 ? 2 : 1;
}

/**
 * The distance in pixels a city above the zoom's label rank must keep from every drawn city to be
 * drawn itself: 36 px up to 2.5x, 22 px up to 5x, then 11.25 px (2.5 dot widths).
 */
export function minDotGap(zoom: number, dotPx: number): number {
  if (zoom >= 5) {
    return dotPx * 2.5;
  }
  return zoom >= 2.5 ? 22 : 36;
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

/** Centre and base radius of the globe in a container: centred in the space the panels leave free. */
export function globeGeometry(frame: GlobeFrame): GlobeGeometry {
  const freeWidth = freeWidthOf(frame);
  return {
    centerX: frame.start + freeWidth / 2,
    centerY: frame.height / 2,
    baseRadius: Math.max(Math.min(freeWidth, frame.height) / 2 - GLOBE_MARGIN, MIN_RADIUS),
  };
}

function freeWidthOf(frame: GlobeFrame): number {
  return Math.max(frame.width - frame.start - frame.end, Math.min(frame.width, MIN_FREE_WIDTH));
}

/** The orthographic projection for a view. Paths drawn through it are cut at the horizon; single points are not (see {@link isVisible}). */
export function createGlobeProjection(view: GlobeView, geometry: GlobeGeometry): GeoProjection {
  return geoOrthographic()
    .rotate([-view.longitude, -view.latitude])
    .scale(geometry.baseRadius * view.zoom)
    .translate([geometry.centerX, geometry.centerY])
    .clipAngle(90);
}

/**
 * Turns the globe by a pointer drag of (`dx`, `dy`) pixels: the surface follows the pointer.
 * Horizontal turns are scaled by the latitude so the point under the pointer keeps up with it.
 */
export function rotateBy(view: GlobeView, dx: number, dy: number, radius: number): GlobeView {
  const degreesPerPixel = toDegrees(1 / Math.max(radius, 1));
  const cosine = Math.max(Math.cos(toRadians(view.latitude)), MIN_COSINE);
  return {
    ...view,
    longitude: wrapLongitude(view.longitude - (dx * degreesPerPixel) / cosine),
    latitude: clamp(view.latitude + dy * degreesPerPixel, -90, 90),
  };
}

/**
 * The view after `elapsedMs` of idle rotation: the surface moves east (to the right), one full turn
 * per {@link IDLE_TURN_MS}. Latitude and zoom stay. A long gap between frames counts as a short one.
 */
export function idleTurn(view: GlobeView, elapsedMs: number): GlobeView {
  const step = clamp(elapsedMs, 0, IDLE_MAX_STEP_MS);
  return { ...view, longitude: wrapLongitude(view.longitude - (360 * step) / IDLE_TURN_MS) };
}

/** Turns the globe by degrees (arrow keys): positive `east` moves the view east, `north` north. */
export function rotateByDegrees(view: GlobeView, east: number, north: number): GlobeView {
  return {
    ...view,
    longitude: wrapLongitude(view.longitude + east),
    latitude: clamp(view.latitude + north, -90, 90),
  };
}

function wrapLongitude(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/**
 * The view that shows a route: a single city is centred at zoom 1; for several the view is centred
 * on their bounding box and as close as {@link MAX_ZOOM} and the free space (less `margin` pixels
 * around) allow. With no cities it is {@link DEFAULT_VIEW}. Cities that cannot all be on the visible
 * half at once leave the zoom at 1.
 */
export function fitRoute(points: GeoPoint[], frame: GlobeFrame, margin: number): GlobeView {
  if (points.length === 0) {
    return { ...DEFAULT_VIEW };
  }
  if (points.length === 1) {
    return { longitude: points[0].longitude, latitude: points[0].latitude, zoom: 1 };
  }
  const geometry = globeGeometry(frame);
  const coordinates = points.map((point): [number, number] => [point.longitude, point.latitude]);
  const arcs = points.slice(1).flatMap((point, i) => arcFitSamples(points[i], point));
  const [longitude, latitude] = geoCentroid({ type: 'MultiPoint', coordinates });
  let view: GlobeView = Number.isFinite(longitude + latitude)
    ? { longitude, latitude, zoom: 1 }
    : { ...points[0], zoom: 1 };

  // Moves the centre to the middle of the cities' bounding box, which is not their centroid.
  for (let i = 0; i < FIT_ITERATIONS; i++) {
    const box = boundingBox(view, geometry, coordinates, arcs);
    if (!box) {
      return { ...view, zoom: 1 };
    }
    const centre = createGlobeProjection(view, geometry).invert?.([
      (box.minX + box.maxX) / 2,
      (box.minY + box.maxY) / 2,
    ]);
    if (!centre || !Number.isFinite(centre[0] + centre[1])) {
      break;
    }
    view = { longitude: centre[0], latitude: centre[1], zoom: 1 };
  }

  const box = boundingBox(view, geometry, coordinates, arcs);
  if (!box) {
    return { ...view, zoom: 1 };
  }
  const halfWidth = (box.maxX - box.minX) / 2;
  const halfHeight = (box.maxY - box.minY) / 2;
  const availableWidth = freeWidthOf(frame) / 2 - margin;
  const availableHeight = frame.height / 2 - margin;
  if (halfWidth < 1 && halfHeight < 1) {
    return { ...view, zoom: 1 };
  }
  const zoom = Math.min(
    halfWidth > 0 ? availableWidth / halfWidth : Infinity,
    halfHeight > 0 ? availableHeight / halfHeight : Infinity,
  );
  return { ...view, zoom: clampZoom(Number.isFinite(zoom) ? zoom : 1) };
}

/** Points along a leg lifted arc, ends left out (the cities are measured on their own). */
function arcFitSamples(from: GeoPoint, to: GeoPoint): ArcSample[] {
  const all = arcSamples(from, to);
  const every = Math.ceil(all.length / ARC_FIT_SAMPLES);
  return all.filter((_, i) => i > 0 && i < all.length - 1 && i % every === 0);
}

/**
 * Pixel bounds of the cities and the visible arc points at zoom 1 (relative to the view), or null when
 * a city is on the far side. The arc points widen the box, so the apex of the arc fits too.
 */
function boundingBox(
  view: GlobeView,
  geometry: GlobeGeometry,
  coordinates: [number, number][],
  arcs: ArcSample[],
) {
  const projection = createGlobeProjection({ ...view, zoom: 1 }, geometry);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [longitude, latitude] of coordinates) {
    // The projection also answers for the far side (mirrored), so visibility is checked first.
    const projected = isVisible({ longitude, latitude }, view)
      ? projection([longitude, latitude])
      : null;
    if (!projected) {
      return null;
    }
    xs.push(projected[0]);
    ys.push(projected[1]);
  }
  for (const sample of arcs) {
    const lifted = projectLifted(sample, sample.lift, { ...view, zoom: 1 }, geometry);
    if (!lifted.hidden) {
      xs.push(lifted.x);
      ys.push(lifted.y);
    }
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * A view between two views, `t` from 0 to 1: the centre follows the great circle between the two
 * centres (so the globe takes the short way round) and the zoom changes in equal factors.
 */
export function interpolateView(from: GlobeView, to: GlobeView, t: number): GlobeView {
  const [longitude, latitude] = geoInterpolate(
    [from.longitude, from.latitude],
    [to.longitude, to.latitude],
  )(t);
  return { longitude, latitude, zoom: from.zoom * Math.pow(to.zoom / from.zoom, t) };
}

/** A point of a lifted arc: where it is on the great circle and how high above the surface. */
export interface ArcSample extends GeoPoint {
  /** Height above the surface as a fraction of the globe radius. */
  lift: number;
}

/** A point drawn above the surface, in CSS pixels, and whether the globe hides it. */
export interface LiftedPoint extends MapPoint {
  hidden: boolean;
}

/** The peak height of an arc over a leg of `angle` radians, as a fraction of the globe radius. */
export function arcPeak(angle: number): number {
  return angle <= 0 ? 0 : clamp(ARC_LIFT_PER_RADIAN * angle, ARC_LIFT_MIN, ARC_LIFT_MAX);
}

/**
 * Where a point `lift` (a fraction of the radius) above the surface lands on screen for a view.
 * The point moves away from the middle of the disc with the height, and up the screen by
 * {@link ARC_LIFT_TILT} times the lift for the part of it that points at the viewer. It is hidden
 * only when it is on the far side AND inside the globe disc: a lifted point just behind the
 * horizon clears the edge and is seen against the sky.
 */
export function projectLifted(
  point: GeoPoint,
  lift: number,
  view: GlobeView,
  geometry: GlobeGeometry,
): LiftedPoint {
  const latitude = toRadians(point.latitude);
  const centreLatitude = toRadians(view.latitude);
  const deltaLongitude = toRadians(point.longitude - view.longitude);
  const x = Math.cos(latitude) * Math.sin(deltaLongitude);
  const y =
    Math.cos(centreLatitude) * Math.sin(latitude) -
    Math.sin(centreLatitude) * Math.cos(latitude) * Math.cos(deltaLongitude);
  const z =
    Math.sin(centreLatitude) * Math.sin(latitude) +
    Math.cos(centreLatitude) * Math.cos(latitude) * Math.cos(deltaLongitude);
  const radius = geometry.baseRadius * view.zoom;
  const dx = radius * (1 + lift) * x;
  const dy = -radius * ((1 + lift) * y + ARC_LIFT_TILT * lift * z);
  return {
    x: geometry.centerX + dx,
    y: geometry.centerY + dy,
    hidden: z < 0 && Math.hypot(dx, dy) < radius,
  };
}

/**
 * The samples of a leg lifted arc from `from` to `to`, along the great circle, evenly spaced: the lift
 * is 0 at both ends and rises to {@link arcPeak} in the middle. They depend only on the two cities,
 * so compute them once per leg and project them for every frame ({@link arcSegments}).
 */
export function arcSamples(from: GeoPoint, to: GeoPoint): ArcSample[] {
  const start: [number, number] = [from.longitude, from.latitude];
  const end: [number, number] = [to.longitude, to.latitude];
  const interpolate = geoInterpolate(start, end);
  const angle = geoDistance(start, end);
  const peak = arcPeak(angle);
  const steps = Math.max(ARC_MIN_STEPS, Math.ceil(toDegrees(angle) / ARC_STEP_DEGREES));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const [longitude, latitude] = interpolate(t);
    return { longitude, latitude, lift: peak * 4 * t * (1 - t) };
  });
}

/**
 * The first part of an arc, `fraction` (0 to 1) of the way along it (drawing it from A to B): the
 * samples before that point and one more exactly at it, interpolated between its neighbours.
 */
export function arcPrefix(samples: ArcSample[], fraction: number): ArcSample[] {
  const last = samples.length - 1;
  const position = clamp(fraction, 0, 1) * last;
  const index = Math.floor(position);
  const rest = position - index;
  const kept = samples.slice(0, index + 1);
  if (rest > 1e-9 && index < last) {
    const a = samples[index];
    const b = samples[index + 1];
    const turn = ((((b.longitude - a.longitude + 180) % 360) + 360) % 360) - 180;
    kept.push({
      longitude: a.longitude + turn * rest,
      latitude: a.latitude + (b.latitude - a.latitude) * rest,
      lift: a.lift + (b.lift - a.lift) * rest,
    });
  }
  return kept;
}

/**
 * The visible parts of a lifted arc (from {@link arcSamples}) in screen pixels, in order: the arc is
 * cut wherever it goes behind the globe (see {@link projectLifted}). Parts of a single point are dropped.
 */
export function arcSegments(
  samples: ArcSample[],
  view: GlobeView,
  geometry: GlobeGeometry,
): MapPoint[][] {
  const segments: MapPoint[][] = [];
  let current: MapPoint[] = [];
  const close = () => {
    if (current.length > 1) {
      segments.push(current);
    }
    current = [];
  };
  for (const sample of samples) {
    const projected = projectLifted(sample, sample.lift, view, geometry);
    if (projected.hidden) {
      close();
    } else {
      current.push({ x: projected.x, y: projected.y });
    }
  }
  close();
  return segments;
}
