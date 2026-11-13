/** Pure helpers for crowded maps: which cities to leave out and how big each hit target may be. */

import { MapPoint } from './globe';

export interface DensityRules<T> {
  point: (item: T) => MapPoint;
  rank: (item: T) => number;
  pinned: (item: T) => boolean;
  /** Cities above this rank are only kept when no kept city lies closer than `minDistance`. */
  maxRank: number;
  /** In pixels. */
  minDistance: number;
}

/**
 * Drops the less important cities that sit on top of a more important one. `items` come in
 * importance order. Pinned cities and cities up to `maxRank` always stay; a city above `maxRank` stays
 * only when no kept city is within `minDistance` pixels. The order is kept.
 */
export function thinOut<T>(items: readonly T[], rules: DensityRules<T>): T[] {
  const kept = items.filter((item) => rules.pinned(item) || rules.rank(item) <= rules.maxRank);
  const keptSet = new Set(kept);
  const limit = rules.minDistance * rules.minDistance;
  for (const item of items) {
    if (keptSet.has(item)) {
      continue;
    }
    const point = rules.point(item);
    const crowded = kept.some((other) => {
      const at = rules.point(other);
      return (at.x - point.x) ** 2 + (at.y - point.y) ** 2 < limit;
    });
    if (!crowded) {
      kept.push(item);
      keptSet.add(item);
    }
  }
  return items.filter((item) => keptSet.has(item));
}

/**
 * Hit radius per point: half the distance to the nearest other point (so two targets never
 * overlap where there is room), at least `min` and at most `max`.
 */
export function hitRadii(points: readonly MapPoint[], min: number, max: number): number[] {
  return points.map((point, index) => {
    let nearest = Infinity;
    points.forEach((other, otherIndex) => {
      if (otherIndex !== index) {
        nearest = Math.min(nearest, Math.hypot(other.x - point.x, other.y - point.y));
      }
    });
    return Math.min(max, Math.max(min, nearest / 2));
  });
}
