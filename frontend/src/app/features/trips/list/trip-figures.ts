import { Comparison, Trip, TransportModeCode, TripPriority } from '../../../core/api/models';
import { MODE_LABELS } from '../../../shared/util/labels';

/** The recommended mode of a trip whose legs all use it, otherwise `MIXED`. */
export type TripMode = TransportModeCode | 'MIXED';

/** What the Trips page shows for one trip, taken from its comparison. */
export interface TripFigures {
  currency: string;
  /** Recommended itinerary, for all travelers. */
  cost: number;
  co2Kg: number;
  /** Car for the whole route; null when the car cannot do it. */
  carCo2Kg: number | null;
  mode: TripMode;
  /** Distinct modes used, in leg order. */
  modes: TransportModeCode[];
}

/** The comparison of one trip: still loading, failed, or loaded (null when no mode is available). */
export type FigureState =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; figures: TripFigures | null };

export interface TripEntry {
  trip: Trip;
  state: FigureState;
}

export interface TripKpis {
  /** All trips in the list. */
  planned: number;
  /** CO₂ not emitted compared with driving every trip; counts trips with a car alternative only. */
  co2SavedKg: number;
  /** Trips behind `co2SavedKg`. */
  co2Trips: number;
  /** Mean recommended cost over the trips whose comparison loaded; null when there are none. */
  averageCost: number | null;
  currency: string | null;
  /** Trips not counted in the CO₂ figure (comparison failed or pending, or no car). */
  leftOut: number;
}

export interface TripFilter {
  search: string;
  /** None selected means all. */
  priorities: readonly TripPriority[];
  /** None selected means all. */
  modes: readonly TransportModeCode[];
}

export interface PriorityColumn {
  priority: TripPriority;
  entries: TripEntry[];
  count: number;
  /** Recommended cost of the loaded trips in the column. */
  totalCost: number;
  currency: string | null;
}

export type Tint = 'lime' | 'amber' | 'none';

export const BOARD_PRIORITIES: readonly TripPriority[] = [
  'FASTEST',
  'CHEAPEST',
  'GREENEST',
  'BALANCED',
];

/** Figures of a trip, or null when it has no available itinerary. */
export function tripFigures(comparison: Comparison): TripFigures | null {
  const itinerary = comparison.recommendedItinerary;
  if (!itinerary) {
    return null;
  }
  const modes = [...new Set(itinerary.modes)];
  const car = comparison.singleModeTotals.find((totals) => totals.mode === 'CAR');
  return {
    currency: comparison.currency,
    cost: itinerary.totalCost,
    co2Kg: itinerary.co2Kg,
    carCo2Kg: car?.available && car.co2Kg !== null ? car.co2Kg : null,
    mode: modes.length === 1 ? modes[0] : 'MIXED',
    modes,
  };
}

/** The figures of an entry, or null while loading, on failure and when none exist. */
export function figuresOf(entry: TripEntry): TripFigures | null {
  return entry.state.status === 'ready' ? entry.state.figures : null;
}

export function tripKpis(entries: readonly TripEntry[]): TripKpis {
  const loaded = entries.map(figuresOf).filter((figures) => figures !== null);
  const withCar = loaded.filter((figures) => figures.carCo2Kg !== null);
  const co2SavedKg = withCar.reduce(
    (sum, figures) => sum + Math.max(0, (figures.carCo2Kg ?? 0) - figures.co2Kg),
    0,
  );
  const averageCost =
    loaded.length === 0
      ? null
      : loaded.reduce((sum, figures) => sum + figures.cost, 0) / loaded.length;
  return {
    planned: entries.length,
    co2SavedKg,
    co2Trips: withCar.length,
    averageCost,
    currency: loaded[0]?.currency ?? null,
    leftOut: entries.length - withCar.length,
  };
}

export function filterTrips(entries: readonly TripEntry[], filter: TripFilter): TripEntry[] {
  const search = filter.search.trim().toLowerCase();
  return entries.filter(({ trip, state }) => {
    if (filter.priorities.length > 0 && !filter.priorities.includes(trip.priority)) {
      return false;
    }
    if (search && !matchesSearch(trip, search)) {
      return false;
    }
    if (filter.modes.length === 0) {
      return true;
    }
    const figures = state.status === 'ready' ? state.figures : null;
    return figures !== null && figures.modes.some((mode) => filter.modes.includes(mode));
  });
}

function matchesSearch(trip: Trip, search: string): boolean {
  return (
    trip.title.toLowerCase().includes(search) ||
    trip.stops.some((stop) => stop.cityName.toLowerCase().includes(search))
  );
}

/** One column per priority in board order, empty ones included. */
export function groupByPriority(entries: readonly TripEntry[]): PriorityColumn[] {
  return BOARD_PRIORITIES.map((priority) => {
    const inColumn = entries.filter(({ trip }) => trip.priority === priority);
    const loaded = inColumn.map(figuresOf).filter((figures) => figures !== null);
    return {
      priority,
      entries: inColumn,
      count: inColumn.length,
      totalCost: loaded.reduce((sum, figures) => sum + figures.cost, 0),
      currency: loaded[0]?.currency ?? null,
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
