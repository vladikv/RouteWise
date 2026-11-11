import { TripPriority } from '../../core/api/models';

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
