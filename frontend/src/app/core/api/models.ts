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

export interface Trip {
  id: number;
  title: string;
  origin: CitySummary;
  destination: CitySummary;
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
  originCityId: number;
  destinationCityId: number;
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

export interface Comparison {
  tripId: number;
  departureDate: string;
  travelers: number;
  priority: TripPriority;
  distanceKm: number;
  currency: string;
  /** Empty when no forecast is available for the departure date. */
  weather: WeatherSummary[];
  /** Available modes best first, then unavailable ones. */
  options: ModeOption[];
}

export interface Advice {
  tripId: number;
  /** Null when no mode is available. */
  recommendedMode: TransportModeCode | null;
  summary: string;
  tips: string[];
  source: AdvisorSource;
}

/** A trip draft parsed from free text; unknown values are null and explained in warnings. */
export interface TripDraft {
  title: string;
  origin: CitySummary | null;
  destination: CitySummary | null;
  departureDate: string | null;
  travelers: number;
  priority: TripPriority;
  notes: string | null;
  source: AdvisorSource;
  warnings: string[];
}
