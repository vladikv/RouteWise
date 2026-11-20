import {
  CitySummary,
  Comparison,
  ModeOption,
  TripPriority,
  UnavailableGroup,
  WeatherSummary,
} from '../../../core/api/models';

/**
 * One leg of a comparison with the trip-level context the chart and the table
 * need. A two-stop route is a single leg, so it reads like a whole trip.
 */
export interface LegComparison {
  from: CitySummary;
  to: CitySummary;
  departureDate: string;
  travelers: number;
  priority: TripPriority;
  /** Straight-line distance of this leg. */
  distanceKm: number;
  currency: string;
  /** Forecasts for this leg's two cities. */
  weather: WeatherSummary[];
  /** Available modes best first, then unavailable ones. */
  options: ModeOption[];
  /** One sentence per reason why modes are unavailable on this leg, worded by the API. */
  unavailableGroups: UnavailableGroup[];
}

export function legComparison(comparison: Comparison, index: number): LegComparison {
  const leg = comparison.legs[index];
  return {
    from: leg.from,
    to: leg.to,
    departureDate: comparison.departureDate,
    travelers: comparison.travelers,
    priority: comparison.priority,
    distanceKm: leg.distanceKm,
    currency: comparison.currency,
    weather: comparison.weather.filter(
      (item) => item.city === leg.from.name || item.city === leg.to.name,
    ),
    options: leg.options,
    unavailableGroups: leg.unavailableGroups,
  };
}

/** Where the trip's priority is changed: its edit page, or nothing for an unsaved comparison (Home). */
export function priorityEditLink(comparison: Comparison): string | null {
  return comparison.tripId === null ? null : `/trips/${comparison.tripId}/edit`;
}

/** Shown when no mode can make a leg: a stop in between (e.g. a city with an airport) splits it. */
export const ADD_STOP_HINT =
  'Try the route with a stop in between, for example a city with an airport.';

/** Whether any of these options is priced from a live flight fare (the rest stay estimates). */
export function hasLiveCost(options: ModeOption[]): boolean {
  return options.some((option) => option.costSource === 'LIVE');
}
