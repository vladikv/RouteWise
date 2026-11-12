/**
 * Types of the RouteWise REST API. They mirror the backend DTO records;
 * keep both sides in sync when a contract changes.
 */

export type TransportModeCode = 'TRAIN' | 'BUS' | 'CAR' | 'BIKE' | 'PLANE';

export type TripPriority = 'FASTEST' | 'CHEAPEST' | 'GREENEST' | 'BALANCED';

export type WeatherHazard = 'RAIN' | 'SNOW' | 'THUNDERSTORM' | 'STRONG_WIND' | 'FREEZING' | 'ICE';

/** Who produced an advisor result: the LLM or the built-in rules. */
export type AdvisorSource = 'AI' | 'RULES';

export interface CitySummary {
  id: number;
  name: string;
  country: string;
}

export interface City extends CitySummary {
  latitude: number;
  longitude: number;
}

/** Cost and CO₂ are per traveler, except CAR (per vehicle). */
export interface TransportMode {
  code: TransportModeCode;
  avgSpeedKmh: number;
  costPerKm: number;
  co2GramsPerKm: number;
  fixedOverheadMinutes: number;
  maxDistanceKm: number;
}

/** One stop of a saved trip, in travel order. */
export interface TripStop {
  cityId: number;
  cityName: string;
  country: string;
  /** 0-based. */
  position: number;
}

/** 2–10 stops; a simple A → B trip has two. */
export const MIN_STOPS = 2;
export const MAX_STOPS = 10;

export interface Trip {
  id: number;
  title: string;
  /** At least two, in travel order. */
  stops: TripStop[];
  /** ISO date, e.g. 2026-11-20. */
  departureDate: string;
  travelers: number;
  priority: TripPriority;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /api/trips and PUT /api/trips/{id}. */
export interface TripRequest {
  title: string;
  /** Replaces the whole ordered stop list. */
  stops: { cityId: number }[];
  departureDate: string;
  travelers: number;
  priority: TripPriority;
  notes?: string | null;
}

export interface WeatherSummary {
  city: string;
  date: string;
  description: string;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationProbabilityPercent: number | null;
  windSpeedMaxKmh: number | null;
  hazards: WeatherHazard[];
}

/** One mode in a comparison. Metrics are null when the mode is unavailable. */
export interface ModeOption {
  mode: TransportModeCode;
  available: boolean;
  unavailableReason: string | null;
  distanceKm: number;
  durationMinutes: number | null;
  totalCost: number | null;
  co2Kg: number | null;
  /** 0–100, higher is better. */
  score: number;
  recommended: boolean;
  notes: string[];
}

/** One leg of a route: stop `index` to stop `index + 1`. */
export interface Leg {
  index: number;
  from: CitySummary;
  to: CitySummary;
  /** Straight-line distance. */
  distanceKm: number;
  /** Available modes best first, then unavailable ones; weather-adjusted for this leg. */
  options: ModeOption[];
  /** Null when no mode is available on this leg. */
  recommendedMode: TransportModeCode | null;
}

/** Totals for the whole route; cost and CO₂ for all travelers. */
export interface ItineraryTotals {
  /** The mode used on each leg, in leg order. */
  modes: TransportModeCode[];
  durationMinutes: number;
  totalCost: number;
  co2Kg: number;
}

/** One mode used for every leg; metrics are null when it is not possible on some leg. */
export interface ModeTotals {
  mode: TransportModeCode;
  available: boolean;
  unavailableReason: string | null;
  durationMinutes: number | null;
  totalCost: number | null;
  co2Kg: number | null;
}

export interface Comparison {
  /** Null for a preview of a route that is not saved as a trip. */
  tripId: number | null;
  departureDate: string;
  travelers: number;
  priority: TripPriority;
  /** Straight-line distance summed over all legs. */
  distanceKm: number;
  currency: string;
  /** One entry per stop city; empty when no forecast is available for the departure date. */
  weather: WeatherSummary[];
  legs: Leg[];
  /** Each leg's recommended mode combined; null when some leg has no available mode. */
  recommendedItinerary: ItineraryTotals | null;
  /** One entry per mode, used for every leg. */
  singleModeTotals: ModeTotals[];
}

/** Body of POST /api/comparisons: compare a route without saving a trip. */
export interface ComparisonRequest {
  stops: { cityId: number }[];
  departureDate: string;
  travelers: number;
  priority: TripPriority;
}

export interface Advice {
  tripId: number;
  /** One per leg; null where no mode is available on that leg. */
  recommendedModes: (TransportModeCode | null)[];
  summary: string;
  /** One sentence per leg. */
  legs: string[];
  tips: string[];
  source: AdvisorSource;
}

/** A trip draft parsed from free text; unknown values are null and explained in warnings. */
export interface TripDraft {
  title: string;
  /** At least two, in travel order; null where a stop is unknown or not a supported city. */
  stops: (CitySummary | null)[];
  departureDate: string | null;
  travelers: number;
  priority: TripPriority;
  notes: string | null;
  source: AdvisorSource;
  warnings: string[];
}

/** The logged-in account. */
export interface User {
  id: number;
  email: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Password 8–72 characters (BCrypt's limit), display name up to 50. */
export interface RegisterRequest extends LoginRequest {
  displayName: string;
}
