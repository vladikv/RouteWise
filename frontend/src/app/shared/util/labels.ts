import {
  TransportModeCode,
  TripPriority,
  UnavailableCode,
  WeatherHazard,
} from '../../core/api/models';

export const PRIORITY_LABELS: Record<TripPriority, string> = {
  FASTEST: 'Fastest',
  CHEAPEST: 'Cheapest',
  GREENEST: 'Greenest',
  BALANCED: 'Balanced',
};

/** What each priority optimises, in one short line. */
export const PRIORITY_DESCRIPTIONS: Record<TripPriority, string> = {
  BALANCED: 'Time, cost and CO₂ weighed equally',
  FASTEST: 'Least time door to door',
  CHEAPEST: 'Lowest total price',
  GREENEST: 'Lowest CO₂ emissions',
};

/** Priorities in the order the trip form offers them. */
export const PRIORITIES: TripPriority[] = ['BALANCED', 'FASTEST', 'CHEAPEST', 'GREENEST'];

export function travelersLabel(travelers: number): string {
  return travelers === 1 ? '1 traveler' : `${travelers} travelers`;
}

export const MODE_LABELS: Record<TransportModeCode, string> = {
  TRAIN: 'Train',
  BUS: 'Bus',
  CAR: 'Car',
  BIKE: 'Bike',
  PLANE: 'Plane',
};

export const HAZARD_LABELS: Record<WeatherHazard, string> = {
  RAIN: 'Rain',
  SNOW: 'Snow',
  THUNDERSTORM: 'Thunderstorms',
  STRONG_WIND: 'Strong wind',
  FREEZING: 'Freezing',
  ICE: 'Icy roads',
};

/** How far away a departure is, e.g. "today", "tomorrow", "in 9 days", "3 days ago". */
export function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) {
    return 'today';
  }
  if (daysUntil === 1) {
    return 'tomorrow';
  }
  if (daysUntil === -1) {
    return 'yesterday';
  }
  return daysUntil > 0 ? `in ${daysUntil} days` : `${-daysUntil} days ago`;
}

/** E.g. 373 → "6 h 13 min", 180 → "3 h", 45 → "45 min". */
export function durationLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

const UNAVAILABLE_TEXT: Record<UnavailableCode, string> = {
  DIFFERENT_LANDMASS: 'different continent or island',
  TOO_FAR: 'too far for this mode',
};

/** The cause in a few readable words; the API's English reason when there is no code. */
export function unavailableDetail(code: UnavailableCode | null, reason: string | null): string {
  return code ? UNAVAILABLE_TEXT[code] : (reason ?? '');
}

/** "Not available: too far for this mode" for one option on one leg. */
export function unavailableText(code: UnavailableCode | null, reason: string | null): string {
  const detail = unavailableDetail(code, reason);
  return detail ? `Not available: ${detail}` : 'Not available';
}

const LEG_PREFIX = /^Leg (\d+) \(([^)]*)\):\s*(.*)$/;

/**
 * Same for a mode used on every leg: the reason names the leg that rules it out
 * ("Leg 2 (A to B): ..."), which is kept: "Not available on leg 2 (A to B): too far for this mode".
 */
export function unavailableTotalsText(code: UnavailableCode | null, reason: string | null): string {
  const match = LEG_PREFIX.exec(reason ?? '');
  if (!match) {
    return unavailableText(code, reason);
  }
  const detail = code ? UNAVAILABLE_TEXT[code] : match[3];
  return `Not available on leg ${match[1]} (${match[2]}): ${detail}`;
}
