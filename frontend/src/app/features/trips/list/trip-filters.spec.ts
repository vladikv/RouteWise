import { TripPage } from '../../../core/api/models';
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  activeChipCount,
  hasActiveFilters,
  modeCounts,
  priorityCounts,
  resultSummary,
  toggleSort,
  tripSearch,
} from './trip-filters';

const PAGE: TripPage = {
  items: [],
  page: 0,
  size: 100,
  totalItems: 0,
  totalPages: 0,
  currency: 'EUR',
  facets: {
    priorities: [
      { priority: 'FASTEST', count: 2 },
      { priority: 'CHEAPEST', count: 1 },
      { priority: 'GREENEST', count: 0 },
      { priority: 'BALANCED', count: 4 },
    ],
    modes: [
      { mode: 'TRAIN', count: 3 },
      { mode: 'BUS', count: 1 },
      { mode: 'CAR', count: 0 },
      { mode: 'BIKE', count: 0 },
      { mode: 'PLANE', count: 2 },
    ],
  },
  priorityTotals: [],
};

describe('tripSearch', () => {
  it('builds the API query from the filters and the sort', () => {
    const query = tripSearch(
      { search: 'vienna', priorities: ['FASTEST'], modes: ['TRAIN', 'BUS'] },
      { key: 'cost', direction: 'desc' },
    );

    expect(query).toEqual({
      q: 'vienna',
      priority: ['FASTEST'],
      mode: ['TRAIN', 'BUS'],
      sort: 'cost',
      direction: 'desc',
      size: PAGE_SIZE,
    });
  });

  it('trims the search text and asks for the largest page', () => {
    const query = tripSearch({ search: '  Berlin ', priorities: [], modes: [] }, DEFAULT_SORT);

    expect(query.q).toBe('Berlin');
    expect(query.size).toBe(100);
    expect(query.sort).toBe('date');
    expect(query.direction).toBe('asc');
  });
});

describe('priorityCounts', () => {
  it('reads the counts of the priority facet, zero included', () => {
    expect(priorityCounts(PAGE)).toEqual({ FASTEST: 2, CHEAPEST: 1, GREENEST: 0, BALANCED: 4 });
  });
});

describe('modeCounts', () => {
  it('reads the counts of the mode facet, zero included', () => {
    expect(modeCounts(PAGE)).toEqual({ TRAIN: 3, BUS: 1, CAR: 0, BIKE: 0, PLANE: 2 });
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
