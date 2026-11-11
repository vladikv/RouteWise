import { TransportModeCode, TripPriority, WeatherHazard } from '../../core/api/models';

export const PRIORITY_LABELS: Record<TripPriority, string> = {
  FASTEST: 'Fastest',
  CHEAPEST: 'Cheapest',
  GREENEST: 'Greenest',
  BALANCED: 'Balanced',
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

/** E.g. 373 → "6 h 13 min", 180 → "3 h", 45 → "45 min". */
export function durationLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
