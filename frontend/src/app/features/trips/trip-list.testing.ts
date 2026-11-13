import {
  TransportModeCode,
  Trip,
  TripFigures,
  TripListItem,
  TripPage,
  TripPriority,
  TripStats,
} from '../../core/api/models';
import { TRIP } from './trip-form.testing';

/** Test data for the Trips page: API pages and stats built from plain trips. */

export const SOLO_TRIP: Trip = {
  ...TRIP,
  id: 8,
  title: 'Solo to Paris',
  travelers: 1,
  priority: 'FASTEST',
  stops: [
    { cityId: 3, cityName: 'Berlin', country: 'DE', position: 0 },
    { cityId: 9, cityName: 'Paris', country: 'FR', position: 1 },
  ],
};

/** Train with a car alternative (saves 71.7 kg), as the API computes it for {@link TRIP}. */
export const TRAIN_FIGURES: TripFigures = {
  totalCost: 150.8,
  co2Kg: 44,
  carCo2Kg: 115.7,
  co2VsCarPercent: -62,
  co2ShareOfCar: 0.38,
  modes: ['TRAIN'],
  legModes: ['TRAIN'],
};

/** Mixed train and bus without a car figure, for {@link SOLO_TRIP}. */
export const MIXED_FIGURES: TripFigures = {
  totalCost: 58,
  co2Kg: 17,
  carCo2Kg: null,
  co2VsCarPercent: null,
  co2ShareOfCar: null,
  modes: ['TRAIN', 'BUS'],
  legModes: ['TRAIN', 'BUS'],
};

const FIGURES_BY_ID: Record<number, TripFigures> = { 7: TRAIN_FIGURES, 8: MIXED_FIGURES };

const PRIORITIES: TripPriority[] = ['FASTEST', 'CHEAPEST', 'GREENEST', 'BALANCED'];
const MODES: TransportModeCode[] = ['TRAIN', 'BUS', 'CAR', 'BIKE', 'PLANE'];

/** A list item; unknown ids get the train figures. `null` means no available route. */
export function listItem(trip: Trip, figures?: TripFigures | null): TripListItem {
  return {
    ...trip,
    figures: figures === undefined ? (FIGURES_BY_ID[trip.id] ?? TRAIN_FIGURES) : figures,
  };
}

/** One API page for the trips, with facets and priority totals derived from them unless overridden. */
export function pageOf(trips: Trip[], overrides: Partial<TripPage> = {}): TripPage {
  const items = trips.map((trip) => listItem(trip));
  return {
    items,
    page: 0,
    size: 100,
    totalItems: items.length,
    totalPages: 1,
    currency: 'EUR',
    facets: {
      priorities: PRIORITIES.map((priority) => ({
        priority,
        count: items.filter((item) => item.priority === priority).length,
      })),
      modes: MODES.map((mode) => ({
        mode,
        count: items.filter((item) => item.figures?.modes.includes(mode)).length,
      })),
    },
    priorityTotals: PRIORITIES.map((priority) => {
      const inColumn = items.filter((item) => item.priority === priority);
      return {
        priority,
        count: inColumn.length,
        totalCost: inColumn.reduce((sum, item) => sum + (item.figures?.totalCost ?? 0), 0),
      };
    }),
    ...overrides,
  };
}

/** Stats for the trips: only trips with a car figure count for the CO2 saving. */
export function statsOf(trips: Trip[], overrides: Partial<TripStats> = {}): TripStats {
  const figures = trips.flatMap((trip) => {
    const item = listItem(trip);
    return item.figures ? [item.figures] : [];
  });
  const withCar = figures.filter((item) => item.carCo2Kg !== null);
  const sorted = [...trips].sort((a, b) => a.departureDate.localeCompare(b.departureDate));
  return {
    tripsPlanned: trips.length,
    co2SavedVsCarKg: withCar.reduce((sum, item) => sum + (item.carCo2Kg! - item.co2Kg), 0),
    co2TripsCounted: withCar.length,
    tripsLeftOut: trips.length - withCar.length,
    averageCost: figures.length
      ? figures.reduce((sum, item) => sum + item.totalCost, 0) / figures.length
      : null,
    currency: 'EUR',
    nextTrip: sorted.length
      ? { id: sorted[0].id, title: sorted[0].title, departureDate: sorted[0].departureDate }
      : null,
    ...overrides,
  };
}
