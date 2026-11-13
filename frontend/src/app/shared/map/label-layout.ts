/** Pure label placement for map points: no label overlaps another label or a dot. */

export type LabelSide = 'right' | 'left' | 'top' | 'bottom';

export interface LabelRequest {
  id: number;
  x: number;
  y: number;
  text: string;
  /** Placed first, and placed even when it has to overlap (the selected route). */
  pinned?: boolean;
  /** Sides to try first, e.g. to keep a route's labels off the route line. */
  preferred?: LabelSide[];
  /** Keeps its dot clear of other labels but gets no label (its label is not wanted at this zoom). */
  dotOnly?: boolean;
}

export interface PlacedLabel {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  side: LabelSide;
}

export interface LabelMetrics {
  /** Font size in drawing units. */
  fontSize: number;
  /** Radius around each dot that labels keep clear of, in drawing units. */
  dotRadius: number;
  /** Labels must lie inside this area (the visible part of the map). */
  bounds?: Box;
  /** Areas labels must stay out of, e.g. buttons drawn over the map. */
  reserved?: Box[];
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const SIDES: LabelSide[] = ['right', 'left', 'top', 'bottom'];
/** Average glyph width relative to the font size for the UI font; slightly generous. */
const CHARACTER_WIDTH = 0.6;
/** Space kept between neighbouring labels, relative to the font size. */
const LABEL_GAP = 0.4;

/**
 * Places a label beside each point, trying the preferred sides, then right, left,
 * top and bottom, and keeps the first box that overlaps no placed label and no
 * other dot. Pinned labels go first; a label that fits nowhere, or a `dotOnly`
 * request, is `null` (hidden at this zoom). Labels are placed in input order after the pinned ones.
 */
export function layoutLabels(
  requests: LabelRequest[],
  metrics: LabelMetrics,
): Map<number, PlacedLabel | null> {
  const ordered = [...requests.filter((r) => r.pinned), ...requests.filter((r) => !r.pinned)];
  const dots: Box[] = requests.map((r) => ({
    left: r.x - metrics.dotRadius,
    top: r.y - metrics.dotRadius,
    right: r.x + metrics.dotRadius,
    bottom: r.y + metrics.dotRadius,
  }));
  const placedBoxes: Box[] = [];
  const result = new Map<number, PlacedLabel | null>();

  for (const request of ordered) {
    if (request.dotOnly) {
      result.set(request.id, null);
      continue;
    }
    const sides = [
      ...(request.preferred ?? []),
      ...SIDES.filter((s) => !request.preferred?.includes(s)),
    ];
    const ownDot = requests.indexOf(request);
    let chosen: { label: PlacedLabel; box: Box } | null = null;
    for (const side of sides) {
      const candidate = candidateFor(request, side, metrics);
      const blocked =
        !inside(candidate.box, metrics.bounds) ||
        (metrics.reserved ?? []).some((box) => overlaps(box, candidate.box)) ||
        placedBoxes.some((box) => overlaps(box, candidate.box)) ||
        dots.some((dot, index) => index !== ownDot && overlaps(dot, candidate.box));
      if (!blocked) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen && request.pinned) {
      chosen = candidateFor(request, sides[0], metrics);
    }
    result.set(request.id, chosen?.label ?? null);
    if (chosen) {
      placedBoxes.push(chosen.box);
    }
  }
  return result;
}

/** Label position and its bounding box for one side of a point. */
export function candidateFor(
  request: LabelRequest,
  side: LabelSide,
  { fontSize, dotRadius }: LabelMetrics,
): { label: PlacedLabel; box: Box } {
  const width = request.text.length * fontSize * CHARACTER_WIDTH;
  const height = fontSize;
  const gap = dotRadius + fontSize * 0.25;
  // `y` is the text baseline; the box spans from the cap height to slightly below the baseline.
  switch (side) {
    case 'left': {
      const x = request.x - gap;
      const y = request.y + height * 0.35;
      return {
        label: { x, y, anchor: 'end', side },
        box: box(x - width, y - height * 0.8, width, height),
      };
    }
    case 'top': {
      const x = request.x;
      const y = request.y - gap;
      return {
        label: { x, y, anchor: 'middle', side },
        box: box(x - width / 2, y - height * 0.8, width, height),
      };
    }
    case 'bottom': {
      const x = request.x;
      const y = request.y + gap + height * 0.8;
      return {
        label: { x, y, anchor: 'middle', side },
        box: box(x - width / 2, y - height * 0.8, width, height),
      };
    }
    default: {
      const x = request.x + gap;
      const y = request.y + height * 0.35;
      return {
        label: { x, y, anchor: 'start', side },
        box: box(x, y - height * 0.8, width, height),
      };
    }
  }
}

function box(left: number, top: number, width: number, height: number): Box {
  const pad = height * LABEL_GAP;
  return {
    left: left - pad,
    top: top - pad,
    right: left + width + pad,
    bottom: top + height + pad,
  };
}

function inside(candidate: Box, bounds: Box | undefined): boolean {
  return (
    !bounds ||
    (candidate.left >= bounds.left &&
      candidate.right <= bounds.right &&
      candidate.top >= bounds.top &&
      candidate.bottom <= bounds.bottom)
  );
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}
