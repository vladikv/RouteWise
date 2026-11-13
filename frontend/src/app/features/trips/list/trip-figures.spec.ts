import { Comparison, Trip } from '../../../core/api/models';
import { COMPARISON, MULTI_COMPARISON } from '../comparison/comparison.testing';
import { TRIP } from '../trip-form.testing';
import {
  FigureState,
  TripEntry,
  TripFigures,
  co2ShareOfCar,
  co2VsCarPercent,
  figuresOf,
  filterTrips,
  groupByPriority,
  modeSummary,
  tintFor,
  tripFigures,
  tripKpis,
} from './trip-figures';

function figures(overrides: Partial<TripFigures> = {}): TripFigures {
  return {
    currency: 'EUR',
    cost: 100,
    co2Kg: 10,
    carCo2Kg: 50,
    mode: 'TRAIN',
    modes: ['TRAIN'],
    legModes: ['TRAIN'],
    ...overrides,
  };
}

function entry(id: number, state: FigureState, overrides: Partial<Trip> = {}): TripEntry {
  return { trip: { ...TRIP, id, ...overrides }, state };
}

function ready(overrides: Partial<TripFigures> = {}): FigureState {
  return { status: 'ready', figures: figures(overrides) };
}

const LOADING: FigureState = { status: 'loading' };
const FAILED: FigureState = { status: 'failed' };

describe('tripFigures', () => {
  it('reads cost, CO2, car CO2 and the single mode of a one-leg trip', () => {
    expect(tripFigures(COMPARISON)).toEqual({
      currency: 'EUR',
      cost: 150.8,
      co2Kg: 44,
      carCo2Kg: 115.7,
      mode: 'TRAIN',
      modes: ['TRAIN'],
      legModes: ['TRAIN'],
    });
  });

  it('reports MIXED with the distinct modes in leg order when legs differ', () => {
    const result = tripFigures(MULTI_COMPARISON);

    expect(result?.mode).toBe('MIXED');
    expect(result?.modes).toEqual(['TRAIN', 'BUS']);
    expect(result?.cost).toBe(58);
    expect(result?.co2Kg).toBe(17);
  });

  it('names a single mode when every leg uses it', () => {
    const comparison: Comparison = {
      ...MULTI_COMPARISON,
      recommendedItinerary: {
        modes: ['PLANE', 'PLANE', 'PLANE'],
        durationMinutes: 1,
        totalCost: 1,
        co2Kg: 1,
      },
    };

    expect(tripFigures(comparison)).toMatchObject({ mode: 'PLANE', modes: ['PLANE'] });
  });

  it('has no car CO2 when car is absent from the totals', () => {
    expect(tripFigures(MULTI_COMPARISON)?.carCo2Kg).toBeNull();
  });

  it('has no car CO2 when car is unavailable or has no figure', () => {
    const unavailable: Comparison = {
      ...COMPARISON,
      singleModeTotals: [
        {
          mode: 'CAR',
          available: false,
          unavailableReason: 'too far',
          durationMinutes: null,
          totalCost: null,
          co2Kg: null,
        },
      ],
    };
    const noFigure: Comparison = {
      ...COMPARISON,
      singleModeTotals: [
        {
          mode: 'CAR',
          available: true,
          unavailableReason: null,
          durationMinutes: 1,
          totalCost: 1,
          co2Kg: null,
        },
      ],
    };

    expect(tripFigures(unavailable)?.carCo2Kg).toBeNull();
    expect(tripFigures(noFigure)?.carCo2Kg).toBeNull();
  });

  it('is null when no itinerary is possible', () => {
    expect(tripFigures({ ...COMPARISON, recommendedItinerary: null })).toBeNull();
  });
});

describe('figuresOf', () => {
  it('returns the figures only for a loaded trip', () => {
    expect(figuresOf(entry(1, ready()))).toEqual(figures());
    expect(figuresOf(entry(1, LOADING))).toBeNull();
    expect(figuresOf(entry(1, FAILED))).toBeNull();
    expect(figuresOf(entry(1, { status: 'ready', figures: null }))).toBeNull();
  });
});

describe('tripKpis', () => {
  it('sums the CO2 saved against the car and averages the cost', () => {
    const kpis = tripKpis([
      entry(1, ready({ cost: 100, co2Kg: 10, carCo2Kg: 50 })),
      entry(2, ready({ cost: 200, co2Kg: 30, carCo2Kg: 40 })),
    ]);

    expect(kpis).toEqual({
      planned: 2,
      co2SavedKg: 50,
      co2Trips: 2,
      averageCost: 150,
      currency: 'EUR',
      leftOut: 0,
    });
  });

  it('never counts a negative saving when the plan emits more than the car', () => {
    const kpis = tripKpis([
      entry(1, ready({ co2Kg: 90, carCo2Kg: 50 })),
      entry(2, ready({ co2Kg: 10, carCo2Kg: 25 })),
    ]);

    expect(kpis.co2SavedKg).toBe(15);
  });

  it('leaves out failed, pending and car-less trips from CO2 and counts them', () => {
    const kpis = tripKpis([
      entry(1, ready({ cost: 100, co2Kg: 10, carCo2Kg: 50 })),
      entry(2, ready({ cost: 300, carCo2Kg: null })),
      entry(3, FAILED),
      entry(4, LOADING),
      entry(5, { status: 'ready', figures: null }),
    ]);

    expect(kpis.planned).toBe(5);
    expect(kpis.co2Trips).toBe(1);
    expect(kpis.co2SavedKg).toBe(40);
    expect(kpis.leftOut).toBe(4);
    expect(kpis.averageCost).toBe(200);
  });

  it('has no average and no currency when nothing loaded', () => {
    const kpis = tripKpis([entry(1, FAILED), entry(2, LOADING)]);

    expect(kpis).toMatchObject({
      planned: 2,
      co2SavedKg: 0,
      averageCost: null,
      currency: null,
      leftOut: 2,
    });
  });

  it('handles an empty list', () => {
    expect(tripKpis([])).toMatchObject({ planned: 0, averageCost: null, leftOut: 0 });
  });
});

describe('filterTrips', () => {
  const berlin = entry(1, ready({ mode: 'TRAIN', modes: ['TRAIN'] }), {
    title: 'Berlin to Vienna',
    priority: 'GREENEST',
  });
  const paris = entry(2, ready({ mode: 'PLANE', modes: ['PLANE'] }), {
    title: 'Weekend away',
    priority: 'FASTEST',
    stops: [
      { cityId: 1, cityName: 'Madrid', country: 'ES', position: 0 },
      { cityId: 2, cityName: 'Paris', country: 'FR', position: 1 },
    ],
  });
  const elsewhere = [
    { cityId: 5, cityName: 'Rome', country: 'IT', position: 0 },
    { cityId: 6, cityName: 'Oslo', country: 'NO', position: 1 },
  ];
  const mixed = entry(3, ready({ mode: 'MIXED', modes: ['TRAIN', 'BUS'] }), {
    title: 'Loop',
    priority: 'GREENEST',
    stops: elsewhere,
  });
  const pending = entry(4, LOADING, {
    title: 'Pending',
    priority: 'CHEAPEST',
    stops: elsewhere,
  });
  const all = [berlin, paris, mixed, pending];
  const none = { search: '', priorities: [], modes: [] };

  it('keeps everything without filters', () => {
    expect(filterTrips(all, none)).toEqual(all);
  });

  it('searches the title case-insensitively', () => {
    expect(filterTrips(all, { ...none, search: 'VIENNA' })).toEqual([berlin]);
  });

  it('searches any stop city', () => {
    expect(filterTrips(all, { ...none, search: ' madrid ' })).toEqual([paris]);
  });

  it('filters by selected priorities, any of them', () => {
    expect(filterTrips(all, { ...none, priorities: ['GREENEST'] })).toEqual([berlin, mixed]);
    expect(filterTrips(all, { ...none, priorities: ['FASTEST', 'CHEAPEST'] })).toEqual([
      paris,
      pending,
    ]);
  });

  it('filters by a mode used on any leg', () => {
    expect(filterTrips(all, { ...none, modes: ['BUS'] })).toEqual([mixed]);
    expect(filterTrips(all, { ...none, modes: ['TRAIN'] })).toEqual([berlin, mixed]);
    expect(filterTrips(all, { ...none, modes: ['PLANE', 'BUS'] })).toEqual([paris, mixed]);
  });

  it('hides trips without loaded figures once a mode is selected', () => {
    const others = [pending, entry(5, FAILED), entry(6, { status: 'ready', figures: null })];

    expect(filterTrips(others, { ...none, modes: ['TRAIN'] })).toEqual([]);
    expect(filterTrips(others, none)).toEqual(others);
  });

  it('combines the filters', () => {
    const result = filterTrips(all, {
      search: 'loop',
      priorities: ['GREENEST'],
      modes: ['TRAIN'],
    });

    expect(result).toEqual([mixed]);
    expect(filterTrips(all, { search: 'loop', priorities: ['FASTEST'], modes: [] })).toEqual([]);
  });
});

describe('groupByPriority', () => {
  it('returns the four columns in board order with counts and loaded totals', () => {
    const columns = groupByPriority([
      entry(1, ready({ cost: 100 }), { priority: 'GREENEST' }),
      entry(2, ready({ cost: 50 }), { priority: 'GREENEST' }),
      entry(3, LOADING, { priority: 'GREENEST' }),
      entry(4, ready({ cost: 70 }), { priority: 'FASTEST' }),
    ]);

    expect(columns.map((column) => column.priority)).toEqual([
      'FASTEST',
      'CHEAPEST',
      'GREENEST',
      'BALANCED',
    ]);
    expect(columns.map((column) => column.count)).toEqual([1, 0, 3, 0]);
    expect(columns.map((column) => column.totalCost)).toEqual([70, 0, 150, 0]);
    expect(columns[2].entries.map((item) => item.trip.id)).toEqual([1, 2, 3]);
    expect(columns[2].currency).toBe('EUR');
    expect(columns[1].currency).toBeNull();
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

describe('CO2 against the car', () => {
  it('gives the share of the car figure, capped at 1, and the signed percentage', () => {
    expect(co2ShareOfCar(figures({ co2Kg: 61, carCo2Kg: 323 }))).toBeCloseTo(0.189, 3);
    expect(co2VsCarPercent(figures({ co2Kg: 61, carCo2Kg: 323 }))).toBe(-81);
    expect(co2ShareOfCar(figures({ co2Kg: 400, carCo2Kg: 323 }))).toBe(1);
    expect(co2VsCarPercent(figures({ co2Kg: 400, carCo2Kg: 323 }))).toBe(24);
  });

  it('gives nothing without a usable car figure', () => {
    expect(co2ShareOfCar(figures({ carCo2Kg: null }))).toBeNull();
    expect(co2VsCarPercent(figures({ carCo2Kg: null }))).toBeNull();
    expect(co2ShareOfCar(figures({ carCo2Kg: 0 }))).toBeNull();
  });
});
