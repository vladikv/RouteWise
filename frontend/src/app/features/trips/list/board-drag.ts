import { TripPriority } from '../../../core/api/models';

/** Pointer travel (px) before a press becomes a drag; below it the press stays a click. */
export const DRAG_THRESHOLD_PX = 6;

/** How long a finger rests on a card before the drag starts, so vertical scrolling still works. */
export const LONG_PRESS_MS = 350;

export interface ColumnBox {
  priority: TripPriority;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function pastThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
}

/** The column whose box contains the point, or null outside all of them. */
export function columnAt(boxes: readonly ColumnBox[], x: number, y: number): TripPriority | null {
  const hit = boxes.find(
    (box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
  );
  return hit?.priority ?? null;
}
