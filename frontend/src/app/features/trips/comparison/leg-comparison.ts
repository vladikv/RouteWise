import {
  CitySummary,
  Comparison,
  ModeOption,
  TripPriority,
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
  };
}
