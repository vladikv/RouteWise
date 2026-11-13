import { TripListItem, TripPage, TripPriority } from '../../../core/api/models';
import { TRIP } from '../trip-form.testing';
import { TripFigures, boardColumns, modeSummary, tintFor, tripEntries } from './trip-figures';

function item(id: number, overrides: Partial<TripListItem> = {}): TripListItem {
  return {
    ...TRIP,
    id,
    figures: {
      totalCost: 100,
      co2Kg: 10,
      carCo2Kg: 50,
      co2VsCarPercent: -80,
      co2ShareOfCar: 0.2,
      modes: ['TRAIN'],
      legModes: ['TRAIN'],
    },
    ...overrides,
  };
}

function page(items: TripListItem[], overrides: Partial<TripPage> = {}): TripPage {
  return {
    items,
    page: 0,
    size: 100,
    totalItems: items.length,
    totalPages: 1,
    currency: 'EUR',
    facets: { priorities: [], modes: [] },
    priorityTotals: [],
    ...overrides,
  };
}

function figures(overrides: Partial<TripFigures> = {}): TripFigures {
  return {
    currency: 'EUR',
    cost: 100,
    co2Kg: 10,
    carCo2Kg: 50,
    co2VsCarPercent: -80,
    co2ShareOfCar: 0.2,
    mode: 'TRAIN',
    modes: ['TRAIN'],
    legModes: ['TRAIN'],
    ...overrides,
  };
}

describe('tripEntries', () => {
  it('splits each item into the trip and its figures, in API order', () => {
    const entries = tripEntries(page([item(2), item(1)]));

    expect(entries.map((entry) => entry.trip.id)).toEqual([2, 1]);
    expect(entries[0].trip).not.toHaveProperty('figures');
    expect(entries[0].figures).toEqual(figures());
  });

  it('reports MIXED with the distinct modes in leg order when legs differ', () => {
    const base = item(1).figures!;
    const mixed = item(1, {
      figures: { ...base, modes: ['TRAIN', 'BUS'], legModes: ['TRAIN', 'BUS', 'BUS'] },
    });

    const [entry] = tripEntries(page([mixed]));

    expect(entry.figures?.mode).toBe('MIXED');
    expect(entry.figures?.modes).toEqual(['TRAIN', 'BUS']);
    expect(entry.figures?.legModes).toEqual(['TRAIN', 'BUS', 'BUS']);
  });

  it('keeps a missing car figure as null', () => {
    const base = item(1).figures!;
    const noCar = item(1, {
      figures: { ...base, carCo2Kg: null, co2VsCarPercent: null, co2ShareOfCar: null },
    });

    const [entry] = tripEntries(page([noCar]));

    expect(entry.figures).toMatchObject({
      carCo2Kg: null,
      co2VsCarPercent: null,
      co2ShareOfCar: null,
    });
  });

  it('has null figures for a trip without an available route', () => {
    expect(tripEntries(page([item(1, { figures: null })]))[0].figures).toBeNull();
  });

  it('returns nothing for an empty page', () => {
    expect(tripEntries(page([]))).toEqual([]);
  });
});

describe('boardColumns', () => {
  const totals = [
    { priority: 'FASTEST' as TripPriority, count: 12, totalCost: 700 },
    { priority: 'GREENEST' as TripPriority, count: 3, totalCost: 150 },
  ];
  const items = [
    item(1, { priority: 'GREENEST' }),
    item(2, { priority: 'GREENEST' }),
    item(3, { priority: 'FASTEST', figures: null }),
  ];
  const data = page(items, { priorityTotals: totals, currency: 'CHF' });
  const entries = tripEntries(data);

  it('returns the four columns in board order', () => {
    const columns = boardColumns(entries, data, []);

    expect(columns.map((column) => column.priority)).toEqual([
      'FASTEST',
      'CHEAPEST',
      'GREENEST',
      'BALANCED',
    ]);
  });

  it('takes the total cost from the API totals', () => {
    const columns = boardColumns(entries, data, []);

    expect(columns.map((column) => column.totalCost)).toEqual([700, 0, 150, 0]);
  });

  it('counts the cards while the page holds every matching trip, so a pending move shows at once', () => {
    const columns = boardColumns(entries, data, []);

    expect(columns.map((column) => column.count)).toEqual([1, 0, 2, 0]);
  });

  it('takes the counts from the API when matching trips are beyond this page', () => {
    const partial = page(items, { priorityTotals: totals, currency: 'CHF', totalItems: 115 });

    const columns = boardColumns(tripEntries(partial), partial, []);

    expect(columns.map((column) => column.count)).toEqual([12, 0, 3, 0]);
  });

  it('puts the cards of each priority in their column, in order', () => {
    const columns = boardColumns(entries, data, []);

    expect(columns[2].entries.map((entry) => entry.trip.id)).toEqual([1, 2]);
    expect(columns[0].entries.map((entry) => entry.trip.id)).toEqual([3]);
    expect(columns[1].entries).toEqual([]);
  });

  it('falls back to the cards in the column when the API has no total for it', () => {
    const columns = boardColumns(entries, page(items), []);

    expect(columns.map((column) => column.count)).toEqual([1, 0, 2, 0]);
    expect(columns.map((column) => column.totalCost)).toEqual([0, 0, 0, 0]);
  });

  it('gives a currency only to columns with at least one trip with figures', () => {
    const columns = boardColumns(entries, data, []);

    expect(columns[2].currency).toBe('CHF');
    expect(columns[0].currency).toBeNull();
    expect(columns[1].currency).toBeNull();
  });

  it('returns only the selected priorities, still in board order', () => {
    const columns = boardColumns(entries, data, ['GREENEST', 'FASTEST']);

    expect(columns.map((column) => column.priority)).toEqual(['FASTEST', 'GREENEST']);
  });
});

describe('tintFor', () => {
  it('tints train and bike lime, plane amber, the rest none', () => {
    expect(tintFor('TRAIN')).toBe('lime');
    expect(tintFor('BIKE')).toBe('lime');
    expect(tintFor('PLANE')).toBe('amber');
    expect(tintFor('CAR')).toBe('none');
    expect(tintFor('BUS')).toBe('none');
    expect(tintFor('MIXED')).toBe('none');
  });
});

describe('modeSummary', () => {
  it('names a single mode and lists the modes of a mixed plan', () => {
    expect(modeSummary(figures({ mode: 'TRAIN' }))).toBe('Train');
    expect(modeSummary(figures({ mode: 'MIXED', modes: ['TRAIN', 'PLANE'] }))).toBe(
      'Mixed: train, plane',
    );
  });
});
