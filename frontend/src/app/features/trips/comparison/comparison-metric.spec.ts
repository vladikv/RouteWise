import { ModeOption } from '../../../core/api/models';
import { bestModes, sortByMetric } from './comparison-metric';

function option(overrides: Partial<ModeOption> & Pick<ModeOption, 'mode'>): ModeOption {
  return {
    available: true,
    unavailableReason: null,
    unavailableCode: null,
    distanceKm: 600,
    durationMinutes: 300,
    totalCost: 100,
    co2Kg: 50,
    score: 50,
    recommended: false,
    notes: [],
    costSource: 'ESTIMATE',
    costRetrievedAt: null,
    ...overrides,
  };
}

const TRAIN = option({
  mode: 'TRAIN',
  score: 87,
  durationMinutes: 373,
  totalCost: 150.8,
  co2Kg: 44,
});
const BUS = option({ mode: 'BUS', score: 70, durationMinutes: 540, totalCost: 45, co2Kg: 30 });
const PLANE = option({
  mode: 'PLANE',
  score: 60,
  durationMinutes: 150,
  totalCost: 210,
  co2Kg: 160,
});
const BIKE = option({
  mode: 'BIKE',
  available: false,
  durationMinutes: null,
  totalCost: null,
  co2Kg: null,
  score: 0,
});
const OPTIONS = [TRAIN, BUS, PLANE, BIKE];

const modes = (options: ModeOption[]) => options.map(({ mode }) => mode);

describe('sortByMetric', () => {
  it('puts the highest score first', () => {
    expect(modes(sortByMetric(OPTIONS, 'score'))).toEqual(['TRAIN', 'BUS', 'PLANE']);
  });

  it('puts the lowest time, cost and CO₂ first', () => {
    expect(modes(sortByMetric(OPTIONS, 'time'))).toEqual(['PLANE', 'TRAIN', 'BUS']);
    expect(modes(sortByMetric(OPTIONS, 'cost'))).toEqual(['BUS', 'TRAIN', 'PLANE']);
    expect(modes(sortByMetric(OPTIONS, 'co2'))).toEqual(['BUS', 'TRAIN', 'PLANE']);
  });

  it('leaves out unavailable modes', () => {
    expect(modes(sortByMetric(OPTIONS, 'score'))).not.toContain('BIKE');
    expect(sortByMetric([BIKE], 'time')).toEqual([]);
  });

  it('keeps the given order for ties and does not change the input', () => {
    const car = option({ mode: 'CAR', totalCost: 45 });
    const input = [TRAIN, car, BUS];

    expect(modes(sortByMetric(input, 'cost'))).toEqual(['CAR', 'BUS', 'TRAIN']);
    expect(modes(input)).toEqual(['TRAIN', 'CAR', 'BUS']);
  });
});

describe('bestModes', () => {
  it('names the best mode per metric', () => {
    expect([...bestModes(OPTIONS, 'score')]).toEqual(['TRAIN']);
    expect([...bestModes(OPTIONS, 'time')]).toEqual(['PLANE']);
    expect([...bestModes(OPTIONS, 'cost')]).toEqual(['BUS']);
    expect([...bestModes(OPTIONS, 'co2')]).toEqual(['BUS']);
  });

  it('names every mode that ties for best, in the given order', () => {
    const car = option({ mode: 'CAR', co2Kg: 30 });

    expect([...bestModes([TRAIN, car, BUS], 'co2')]).toEqual(['CAR', 'BUS']);
  });

  it('never names an unavailable mode, even with a better (null = 0) value', () => {
    expect(bestModes(OPTIONS, 'time').has('BIKE')).toBe(false);
    expect(bestModes([BIKE], 'cost').size).toBe(0);
  });
});
