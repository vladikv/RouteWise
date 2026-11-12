import { Trip } from '../../../core/api/models';
import { TRIP } from '../trip-form.testing';
import { ColumnBox, columnAt, pastThreshold } from './board-drag';
import {
  moveFailedMessage,
  moveRequest,
  moveTargets,
  movedMessage,
  replaceTrip,
  withPriority,
} from './trip-move';

const OTHER: Trip = { ...TRIP, id: 8, title: 'Other', priority: 'FASTEST' };

describe('moveRequest', () => {
  it('keeps every field of the trip and changes only the priority', () => {
    expect(moveRequest(TRIP, 'CHEAPEST')).toEqual({
      title: 'Berlin to Vienna',
      stops: [{ cityId: 3 }, { cityId: 23 }],
      departureDate: '2099-05-20',
      travelers: 2,
      priority: 'CHEAPEST',
      notes: 'Window seat',
    });
  });

  it('sends stops in travel order, a past date unchanged and no notes as null', () => {
    const trip: Trip = {
      ...TRIP,
      departureDate: '2001-01-01',
      notes: null,
      stops: [
        { cityId: 23, cityName: 'Vienna', country: 'AT', position: 1 },
        { cityId: 3, cityName: 'Berlin', country: 'DE', position: 0 },
      ],
    };

    const request = moveRequest(trip, 'FASTEST');

    expect(request.stops).toEqual([{ cityId: 3 }, { cityId: 23 }]);
    expect(request.departureDate).toBe('2001-01-01');
    expect(request.notes).toBeNull();
  });
});

describe('list updates', () => {
  it('changes the priority in place, so the order stays', () => {
    const list = withPriority([OTHER, TRIP], 8, 'CHEAPEST');

    expect(list.map((trip) => [trip.id, trip.priority])).toEqual([
      [8, 'CHEAPEST'],
      [7, 'GREENEST'],
    ]);
    expect(OTHER.priority).toBe('FASTEST');
  });

  it('replaces a trip by id with the saved one', () => {
    const saved: Trip = { ...TRIP, priority: 'BALANCED', updatedAt: '2026-11-12T08:00:00Z' };

    expect(replaceTrip([OTHER, TRIP], saved)).toEqual([OTHER, saved]);
  });

  it('offers the three other priorities in board order', () => {
    expect(moveTargets('CHEAPEST')).toEqual(['FASTEST', 'GREENEST', 'BALANCED']);
  });

  it('words the announcement and the failure', () => {
    expect(movedMessage(TRIP, 'CHEAPEST')).toBe('Moved "Berlin to Vienna" to Cheapest');
    expect(moveFailedMessage(TRIP, 'CHEAPEST', 'Boom.')).toBe(
      'Couldn\'t move "Berlin to Vienna" to Cheapest. Boom.',
    );
  });
});

describe('board drag helpers', () => {
  const boxes: ColumnBox[] = [
    { priority: 'FASTEST', left: 0, right: 100, top: 0, bottom: 300 },
    { priority: 'CHEAPEST', left: 110, right: 210, top: 0, bottom: 300 },
  ];

  it('finds the column under a point', () => {
    expect(columnAt(boxes, 50, 50)).toBe('FASTEST');
    expect(columnAt(boxes, 150, 299)).toBe('CHEAPEST');
  });

  it('finds nothing in the gap or outside', () => {
    expect(columnAt(boxes, 105, 50)).toBeNull();
    expect(columnAt(boxes, 50, 400)).toBeNull();
  });

  it('starts a drag only after a few pixels of travel', () => {
    expect(pastThreshold(2, 2)).toBe(false);
    expect(pastThreshold(0, 6)).toBe(true);
  });
});
