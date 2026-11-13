import { MAX_STOPS, MIN_STOPS, Trip, TripPriority } from '../../core/api/models';
import { todayIso } from '../../shared/util/date';
import { PRIORITIES } from '../../shared/util/labels';
import { TripPreset } from './trip-form';

const MAX_TITLE = 100;
const COPY_SUFFIX = ' (copy)';

/** What "Duplicate" hands to `/trips/new` in the router navigation state. */
export interface TripDuplicateDraft {
  title: string;
  /** City ids in travel order. */
  stops: number[];
  /** Empty when the original's date is in the past. */
  departureDate: string;
  travelers: number;
  priority: TripPriority;
  notes: string;
}

/** The navigation state for duplicating a trip: its fields, "(copy)" on the title, a past date dropped. */
export function duplicateState(
  trip: Trip,
  today: string = todayIso(),
): { draft: TripDuplicateDraft } {
  return {
    draft: {
      title: `${trip.title.slice(0, MAX_TITLE - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
      stops: trip.stops.map((stop) => stop.cityId),
      departureDate: trip.departureDate >= today ? trip.departureDate : '',
      travelers: trip.travelers,
      priority: trip.priority,
      notes: trip.notes ?? '',
    },
  };
}

/**
 * The preset for the New trip form from router navigation state, or null when there is no
 * usable draft. Fields that are not valid values are left out, as with the query parameters.
 */
export function presetFromState(state: unknown, today: string = todayIso()): TripPreset | null {
  const draft = (state as { draft?: unknown } | null | undefined)?.draft;
  if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) {
    return null;
  }
  const { title, stops, departureDate, travelers, priority, notes } = draft as Record<
    string,
    unknown
  >;
  const preset: TripPreset = {
    ...(typeof title === 'string' && title.trim() !== '' && title.length <= MAX_TITLE && { title }),
    ...(Array.isArray(stops) &&
      stops.length >= MIN_STOPS &&
      stops.length <= MAX_STOPS &&
      stops.every((id) => Number.isInteger(id)) && { stops: stops as number[] }),
    ...(typeof departureDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(departureDate) &&
      departureDate >= today && { departureDate }),
    ...(typeof travelers === 'number' &&
      Number.isInteger(travelers) &&
      travelers >= 1 &&
      travelers <= 9 && { travelers }),
    ...(PRIORITIES.find((option) => option === priority) && {
      priority: priority as TripPriority,
    }),
    ...(typeof notes === 'string' && notes.length <= 1000 && { notes }),
  };
  return Object.keys(preset).length > 0 ? preset : null;
}
