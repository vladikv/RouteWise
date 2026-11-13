import { TransportModeCode, Trip, TripPage, TripPriority } from '../../../core/api/models';
import { MODE_LABELS } from '../../../shared/util/labels';

/** The recommended mode of a trip whose legs all use it, otherwise `MIXED`. */
export type TripMode = TransportModeCode | 'MIXED';

/** What the Trips page shows for one trip; every number comes from the API. */
export interface TripFigures {
  currency: string;
  /** Recommended itinerary, for all travelers. */
  cost: number;
  co2Kg: number;
  /** Car for the whole route; null when the car cannot do it. */
  carCo2Kg: number | null;
  /** Signed change against the car, e.g. -81; null without a car figure. */
  co2VsCarPercent: number | null;
  /** The plan's CO₂ as a share (0–1) of the car's; null without a car figure. */
  co2ShareOfCar: number | null;
  mode: TripMode;
  /** Distinct modes used, in leg order. */
  modes: TransportModeCode[];
  /** The mode of every leg, in leg order. */
  legModes: TransportModeCode[];
}

/** A trip and its figures (null when the API found no available route). */
export interface TripEntry {
  trip: Trip;
  figures: TripFigures | null;
}

export interface PriorityColumn {
  priority: TripPriority;
  entries: TripEntry[];
  count: number;
  /** Recommended cost of all matching trips in the column, from the API. */
  totalCost: number;
  /** Null while no trip in the column has figures. */
  currency: string | null;
}

export type Tint = 'lime' | 'amber' | 'none';

export const BOARD_PRIORITIES: readonly TripPriority[] = [
  'FASTEST',
  'CHEAPEST',
  'GREENEST',
  'BALANCED',
];

/** The page's trips in API order, with their figures in the shape the cards and rows use. */
export function tripEntries(page: TripPage): TripEntry[] {
  return page.items.map(({ figures, ...trip }) => ({
    trip,
    figures: figures && {
      currency: page.currency,
      cost: figures.totalCost,
      co2Kg: figures.co2Kg,
      carCo2Kg: figures.carCo2Kg,
      co2VsCarPercent: figures.co2VsCarPercent,
      co2ShareOfCar: figures.co2ShareOfCar,
      mode: figures.modes.length === 1 ? figures.modes[0] : 'MIXED',
      modes: figures.modes,
      legModes: figures.legModes,
    },
  }));
}

/**
 * One board column per priority (only the selected ones, if any), in board order. The cards are
 * the entries of that priority; the total cost is the API's `priorityTotals`. The count is the
 * cards in the column while the page holds every matching trip (so an optimistic move shows at
 * once), otherwise the API's count.
 */
export function boardColumns(
  entries: readonly TripEntry[],
  page: TripPage,
  selected: readonly TripPriority[],
): PriorityColumn[] {
  const complete = page.items.length === page.totalItems;
  return BOARD_PRIORITIES.filter(
    (priority) => selected.length === 0 || selected.includes(priority),
  ).map((priority) => {
    const inColumn = entries.filter(({ trip }) => trip.priority === priority);
    const totals = page.priorityTotals.find((item) => item.priority === priority);
    return {
      priority,
      entries: inColumn,
      count: complete || !totals ? inColumn.length : totals.count,
      totalCost: totals?.totalCost ?? 0,
      currency: inColumn.some(({ figures }) => figures !== null) ? page.currency : null,
    };
  });
}

/** Card tint: lime for train and bike, amber for plane, none for car, bus and mixed plans. */
export function tintFor(mode: TripMode): Tint {
  if (mode === 'TRAIN' || mode === 'BIKE') {
    return 'lime';
  }
  return mode === 'PLANE' ? 'amber' : 'none';
}

/** E.g. "Train", "Mixed: train, plane". */
export function modeSummary(figures: TripFigures): string {
  if (figures.mode !== 'MIXED') {
    return MODE_LABELS[figures.mode];
  }
  return `Mixed: ${figures.modes.map((mode) => MODE_LABELS[mode].toLowerCase()).join(', ')}`;
}
