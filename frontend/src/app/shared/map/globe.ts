/** Pure globe maths: orthographic projection, visibility, rotation, route fit and great-circle arcs. */

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
const GLOBE_MARGIN = 12;
const MIN_RADIUS = 40;
const MIN_FREE_WIDTH = 240;
const EARTH_RADIUS_KM = 6371;
/** Latitude cosines below this are not used to scale a horizontal drag (it would spin at the poles). */
const MIN_COSINE = 0.15;
const FIT_ITERATIONS = 3;
/** One sample per this many degrees along a great-circle arc. */
const ARC_STEP_DEGREES = 2;

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
  const [longitude, latitude] = geoCentroid({ type: 'MultiPoint', coordinates });
  let view: GlobeView = Number.isFinite(longitude + latitude)
    ? { longitude, latitude, zoom: 1 }
    : { ...points[0], zoom: 1 };

  // Moves the centre to the middle of the cities' bounding box, which is not their centroid.
  for (let i = 0; i < FIT_ITERATIONS; i++) {
    const box = boundingBox(view, geometry, coordinates);
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

  const box = boundingBox(view, geometry, coordinates);
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

/** Pixel bounds of the points at zoom 1 (relative to the view), or null when one is on the far side. */
function boundingBox(view: GlobeView, geometry: GlobeGeometry, coordinates: [number, number][]) {
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

/** Samples along the great circle from `from` to `to` as [longitude, latitude], both ends included. */
export function greatCircle(from: GeoPoint, to: GeoPoint): [number, number][] {
  const start: [number, number] = [from.longitude, from.latitude];
  const end: [number, number] = [to.longitude, to.latitude];
  const interpolate = geoInterpolate(start, end);
  const steps = Math.max(2, Math.ceil(toDegrees(geoDistance(start, end)) / ARC_STEP_DEGREES));
  return Array.from({ length: steps + 1 }, (_, i) => interpolate(i / steps));
}
