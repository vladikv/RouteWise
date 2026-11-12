import { Trip, TripPriority, TripRequest } from '../../../core/api/models';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { BOARD_PRIORITIES } from './trip-figures';

/** A request to give a trip another priority (a board drop or a menu item). */
export interface TripMove {
  trip: Trip;
  priority: TripPriority;
  /** Asked from a menu: keep keyboard focus on the trip's title link afterwards. */
  focus?: boolean;
}

/**
 * The update request for a trip with only its priority changed. Every other field is sent as it
 * is, the departure date included: the API accepts an unchanged past date on update.
 */
export function moveRequest(trip: Trip, priority: TripPriority): TripRequest {
  return {
    title: trip.title,
    stops: [...trip.stops]
      .sort((a, b) => a.position - b.position)
      .map((stop) => ({ cityId: stop.cityId })),
    departureDate: trip.departureDate,
    travelers: trip.travelers,
    priority,
    notes: trip.notes,
  };
}

/** The list with one trip's priority changed in place, so its place in the order is kept. */
export function withPriority(list: Trip[], id: number, priority: TripPriority): Trip[] {
  return list.map((trip) => (trip.id === id ? { ...trip, priority } : trip));
}

/** The list with the trip of the same id replaced by `saved`. */
export function replaceTrip(list: Trip[], saved: Trip): Trip[] {
  return list.map((trip) => (trip.id === saved.id ? saved : trip));
}

/** The priorities a trip can move to, in board order. */
export function moveTargets(current: TripPriority): TripPriority[] {
  return BOARD_PRIORITIES.filter((priority) => priority !== current);
}

export function movedMessage(trip: Trip, priority: TripPriority): string {
  return `Moved "${trip.title}" to ${PRIORITY_LABELS[priority]}`;
}

export function moveFailedMessage(trip: Trip, priority: TripPriority, reason: string): string {
  return `Couldn't move "${trip.title}" to ${PRIORITY_LABELS[priority]}. ${reason}`;
}
