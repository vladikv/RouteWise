/** Pure map maths: Mercator projection fitted to a set of places, and great-circle distance. */

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

export type Projection = (point: GeoPoint) => MapPoint;

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Mercator y for a latitude: stretches towards the poles so shapes keep their angles. */
const mercatorY = (latitude: number): number =>
  Math.log(Math.tan(Math.PI / 4 + toRadians(latitude) / 2));

/**
 * Builds a projection that fits all `points` into a `width` × `height` box with
 * `padding` on every side, keeping the aspect ratio and centring the result.
 * North is up. With fewer than two distinct points everything maps to the centre.
 */
export function createProjection(
  points: GeoPoint[],
  width: number,
  height: number,
  padding: number,
): Projection {
  const xs = points.map((point) => toRadians(point.longitude));
  const ys = points.map((point) => mercatorY(point.latitude));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const scale = Math.min(
    spanX > 0 ? innerWidth / spanX : Infinity,
    spanY > 0 ? innerHeight / spanY : Infinity,
  );

  if (points.length === 0 || !Number.isFinite(scale)) {
    return () => ({ x: width / 2, y: height / 2 });
  }
  const offsetX = padding + (innerWidth - spanX * scale) / 2;
  const offsetY = padding + (innerHeight - spanY * scale) / 2;
  return (point) => ({
    x: offsetX + (toRadians(point.longitude) - minX) * scale,
    y: offsetY + (maxY - mercatorY(point.latitude)) * scale,
  });
}

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

/**
 * SVG path for a gently curved route between two map points: a quadratic curve
 * whose control point sits off the midpoint, perpendicular to the straight line.
 */
export function routeArc(from: MapPoint, to: MapPoint, curvature = 0.18): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const controlX = midX - (to.y - from.y) * curvature;
  const controlY = midY + (to.x - from.x) * curvature;
  return `M ${round(from.x)} ${round(from.y)} Q ${round(controlX)} ${round(controlY)} ${round(to.x)} ${round(to.y)}`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
