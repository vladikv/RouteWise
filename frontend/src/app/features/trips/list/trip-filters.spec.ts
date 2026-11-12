import { Trip } from '../../../core/api/models';
import { TRIP } from '../trip-form.testing';
import { FigureState, TripEntry } from './trip-figures';
import {
  DEFAULT_SORT,
  activeChipCount,
  hasActiveFilters,
  modeCounts,
  priorityCounts,
  resultSummary,
  sortTrips,
  toggleSort,
} from './trip-filters';

function entry(id: number, priority: Trip['priority'], state: FigureState): TripEntry {
  return { trip: { ...TRIP, id, priority }, state };
}

function ready(modes: ('TRAIN' | 'BUS' | 'PLANE')[]): FigureState {
  return {
    status: 'ready',
    figures: {
      currency: 'EUR',
      cost: 1,
      co2Kg: 1,
      carCo2Kg: null,
      mode: modes.length === 1 ? modes[0] : 'MIXED',
      modes,
      legModes: modes,
    },
  };
}

const ENTRIES = [
  entry(1, 'FASTEST', ready(['TRAIN'])),
  entry(2, 'FASTEST', ready(['TRAIN', 'BUS'])),
  entry(3, 'GREENEST', { status: 'loading' }),
  entry(4, 'BALANCED', { status: 'failed' }),
  entry(5, 'CHEAPEST', { status: 'ready', figures: null }),
];

describe('priorityCounts', () => {
  it('counts the trips per priority, zero included', () => {
    expect(priorityCounts(ENTRIES)).toEqual({ FASTEST: 2, CHEAPEST: 1, GREENEST: 1, BALANCED: 1 });
    expect(priorityCounts([])).toEqual({ FASTEST: 0, CHEAPEST: 0, GREENEST: 0, BALANCED: 0 });
  });
});

describe('modeCounts', () => {
  it('counts trips whose recommended itinerary uses the mode, ignoring trips without figures', () => {
    expect(modeCounts(ENTRIES)).toEqual({ TRAIN: 2, BUS: 1, CAR: 0, BIKE: 0, PLANE: 0 });
  });
});

describe('resultSummary', () => {
  it('reads "shown of total trips" with the right plural', () => {
    expect(resultSummary(3, 5)).toBe('3 of 5 trips');
    expect(resultSummary(0, 5)).toBe('0 of 5 trips');
    expect(resultSummary(1, 1)).toBe('1 of 1 trip');
  });
});

describe('active filters', () => {
  it('counts selected chips but not the search', () => {
    expect(activeChipCount({ priorities: ['FASTEST'], modes: ['BUS', 'CAR'] })).toBe(3);
    expect(activeChipCount({ priorities: [], modes: [] })).toBe(0);
  });

  it('is active with a search or any chip, and not for blank search', () => {
    expect(hasActiveFilters({ search: '  ', priorities: [], modes: [] })).toBe(false);
    expect(hasActiveFilters({ search: 'x', priorities: [], modes: [] })).toBe(true);
    expect(hasActiveFilters({ search: '', priorities: [], modes: ['BUS'] })).toBe(true);
  });
});

describe('sortTrips', () => {
  function priced(id: number, date: string, cost: number | null, co2Kg = 1): TripEntry {
    const base = entry(id, 'FASTEST', cost === null ? { status: 'failed' } : ready(['TRAIN']));
    const state: FigureState =
      base.state.status === 'ready'
        ? { status: 'ready', figures: { ...base.state.figures!, cost: cost as number, co2Kg } }
        : base.state;
    return { trip: { ...base.trip, departureDate: date }, state };
  }

  const a = priced(1, '2099-03-01', 300, 5);
  const b = priced(2, '2099-01-01', 100, 30);
  const c = priced(3, '2099-02-01', 200, 10);
  const none = priced(4, '2099-01-15', null);
  const ids = (entries: TripEntry[]): number[] => entries.map((item) => item.trip.id);

  it('orders by date, earliest first by default', () => {
    expect(ids(sortTrips([a, b, c], DEFAULT_SORT))).toEqual([2, 3, 1]);
    expect(ids(sortTrips([a, b, c], { key: 'date', direction: 'desc' }))).toEqual([1, 3, 2]);
  });

  it('orders by cost and by CO2 in both directions', () => {
    expect(ids(sortTrips([a, b, c], { key: 'cost', direction: 'asc' }))).toEqual([2, 3, 1]);
    expect(ids(sortTrips([a, b, c], { key: 'cost', direction: 'desc' }))).toEqual([1, 3, 2]);
    expect(ids(sortTrips([a, b, c], { key: 'co2', direction: 'asc' }))).toEqual([1, 3, 2]);
    expect(ids(sortTrips([a, b, c], { key: 'co2', direction: 'desc' }))).toEqual([2, 3, 1]);
  });

  it('puts trips without figures last, whichever the direction', () => {
    const loading: TripEntry = { ...c, state: { status: 'loading' } };
    const all = [none, a, b, loading];

    expect(ids(sortTrips(all, { key: 'cost', direction: 'asc' }))).toEqual([2, 1, 4, 3]);
    expect(ids(sortTrips(all, { key: 'cost', direction: 'desc' }))).toEqual([1, 2, 4, 3]);
    expect(ids(sortTrips(all, { key: 'co2', direction: 'asc' }))).toEqual([1, 2, 4, 3]);
  });

  it('keeps the incoming order for equal values and does not change the input', () => {
    const same = [priced(5, '2099-01-01', 50), priced(6, '2099-01-01', 50)];

    expect(ids(sortTrips(same, { key: 'cost', direction: 'desc' }))).toEqual([5, 6]);
    const input = [a, b];
    sortTrips(input, DEFAULT_SORT);
    expect(ids(input)).toEqual([1, 2]);
  });
});

describe('toggleSort', () => {
  it('flips the direction of the active column and starts another one ascending', () => {
    expect(toggleSort({ key: 'date', direction: 'asc' }, 'date')).toEqual({
      key: 'date',
      direction: 'desc',
    });
    expect(toggleSort({ key: 'date', direction: 'desc' }, 'date')).toEqual({
      key: 'date',
      direction: 'asc',
    });
    expect(toggleSort({ key: 'date', direction: 'desc' }, 'cost')).toEqual({
      key: 'cost',
      direction: 'asc',
    });
  });
});
