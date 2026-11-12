import { Trip } from '../../../core/api/models';
import { TRIP } from '../trip-form.testing';
import { FigureState, TripEntry } from './trip-figures';
import {
  activeChipCount,
  hasActiveFilters,
  modeCounts,
  priorityCounts,
  resultSummary,
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
