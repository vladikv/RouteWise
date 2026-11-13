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

export type Continent =
  'AFRICA' | 'ASIA' | 'EUROPE' | 'NORTH_AMERICA' | 'OCEANIA' | 'SOUTH_AMERICA';

export interface City extends CitySummary {
  latitude: number;
  longitude: number;
  continent: Continent;
  /** Ground-connected region (e.g. EURASIA, JAPAN); ground modes need the same landmass. */
  landmass: string;
  capital: boolean;
  /** 1 = labelled first on the map … 3 = only when zoomed in. */
  labelRank: number;
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

/** A trip's recommended plan computed by the API without weather; cost and CO₂ for all travelers. */
export interface TripFigures {
  totalCost: number;
  co2Kg: number;
  /** The car for the whole route; null when the car cannot do every leg. */
  carCo2Kg: number | null;
  /** Signed change against the car, e.g. -81; null without a car figure. */
  co2VsCarPercent: number | null;
  /** The plan's CO₂ as a share of the car's, 0–1; null without a car figure. */
  co2ShareOfCar: number | null;
  /** Distinct modes of the plan, in leg order. */
  modes: TransportModeCode[];
  /** The recommended mode of each leg. */
  legModes: TransportModeCode[];
}

/** A trip in the list with its figures (null when some leg has no available mode). */
export interface TripListItem extends Trip {
  figures: TripFigures | null;
}

export type TripSortKey = 'date' | 'cost' | 'co2';

/** Query of GET /api/trips; omitted values use the API defaults (all trips, date ascending, page 0 of 20). */
export interface TripSearch {
  q?: string;
  priority?: readonly TripPriority[];
  mode?: readonly TransportModeCode[];
  /** ISO dates, inclusive. */
  from?: string;
  to?: string;
  sort?: TripSortKey;
  direction?: 'asc' | 'desc';
  page?: number;
  /** 1–100. */
  size?: number;
}

/** One page of GET /api/trips. */
export interface TripPage {
  items: TripListItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  currency: string;
  /** Chip counts; each dimension ignores its own filter. Every priority and mode is listed. */
  facets: {
    priorities: { priority: TripPriority; count: number }[];
    modes: { mode: TransportModeCode; count: number }[];
  };
  /** Per priority over all matching trips (not only this page). */
  priorityTotals: { priority: TripPriority; count: number; totalCost: number }[];
}

/** GET /api/trips/stats: key figures over all of the user's trips. */
export interface TripStats {
  tripsPlanned: number;
  co2SavedVsCarKg: number;
  /** Trips behind the CO₂ figure (those with a car alternative). */
  co2TripsCounted: number;
  tripsLeftOut: number;
  /** Null when no trip has figures. */
  averageCost: number | null;
  currency: string;
  nextTrip: { id: number; title: string; departureDate: string } | null;
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

/** Why a mode is unavailable: the cities are on different landmasses, or the leg is beyond the mode's range. */
export type UnavailableCode = 'DIFFERENT_LANDMASS' | 'TOO_FAR';

/** Modes ruled out for the same reason, with one readable sentence for all of them. */
export interface UnavailableGroup {
  code: UnavailableCode;
  /** In the order train, bus, car, bike, plane. */
  modes: TransportModeCode[];
  /** E.g. "Not reachable by land between Dublin and Madrid: train, bus, car, bike". */
  message: string;
}

/** How complete the weather behind a comparison is. */
export type WeatherStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'OUT_OF_RANGE';

/** One mode in a comparison. Metrics are null when the mode is unavailable. */
export interface ModeOption {
  mode: TransportModeCode;
  available: boolean;
  unavailableReason: string | null;
  /** Machine-readable cause; null when available. The leg's `unavailableGroups` word it for people. */
  unavailableCode: UnavailableCode | null;
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
  /** One sentence per reason why modes are unavailable on this leg; empty when all are available. */
  unavailableGroups: UnavailableGroup[];
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
  /** Cause on the first leg that rules the mode out; the comparison's `unavailableGroups` word it. */
  unavailableCode: UnavailableCode | null;
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
  weatherStatus: WeatherStatus;
  legs: Leg[];
  /** Each leg's recommended mode combined; null when some leg has no available mode. */
  recommendedItinerary: ItineraryTotals | null;
  /** One entry per mode, used for every leg. */
  singleModeTotals: ModeTotals[];
  /** Why single modes cannot be used for the whole route, one sentence per reason. */
  unavailableGroups: UnavailableGroup[];
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
