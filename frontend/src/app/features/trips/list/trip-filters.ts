import { TransportModeCode, TripPriority } from '../../../core/api/models';
import { BOARD_PRIORITIES, TripEntry, TripFilter, figuresOf } from './trip-figures';

export const FILTER_MODES: readonly TransportModeCode[] = ['TRAIN', 'BUS', 'CAR', 'BIKE', 'PLANE'];

/** Trips per priority. */
export function priorityCounts(entries: readonly TripEntry[]): Record<TripPriority, number> {
  const counts = Object.fromEntries(BOARD_PRIORITIES.map((priority) => [priority, 0]));
  for (const { trip } of entries) {
    counts[trip.priority]++;
  }
  return counts as Record<TripPriority, number>;
}

/** Trips whose recommended itinerary uses each mode on at least one leg; trips without figures count nowhere. */
export function modeCounts(entries: readonly TripEntry[]): Record<TransportModeCode, number> {
  const counts = Object.fromEntries(FILTER_MODES.map((mode) => [mode, 0]));
  for (const entry of entries) {
    for (const mode of figuresOf(entry)?.modes ?? []) {
      counts[mode]++;
    }
  }
  return counts as Record<TransportModeCode, number>;
}

/** "3 of 5 trips" (and "1 of 1 trip"). */
export function resultSummary(shown: number, total: number): string {
  return `${shown} of ${total} ${total === 1 ? 'trip' : 'trips'}`;
}

/** Selected chips; the search text is not counted. */
export function activeChipCount(filter: Pick<TripFilter, 'priorities' | 'modes'>): number {
  return filter.priorities.length + filter.modes.length;
}

/** Whether the list is narrowed by a search or any chip. */
export function hasActiveFilters(filter: TripFilter): boolean {
  return filter.search.trim() !== '' || activeChipCount(filter) > 0;
}
