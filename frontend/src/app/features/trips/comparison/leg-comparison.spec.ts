import { Comparison } from '../../../core/api/models';
import { MULTI_COMPARISON } from './comparison.testing';
import { legComparison } from './leg-comparison';

describe('legComparison', () => {
  it('takes one leg with the trip context and only that leg’s weather', () => {
    const comparison: Comparison = {
      ...MULTI_COMPARISON,
      weather: ['Berlin', 'Prague', 'Vienna'].map((city) => ({
        city,
        date: '2099-05-20',
        description: 'Clear',
        temperatureMinC: 1,
        temperatureMaxC: 9,
        precipitationProbabilityPercent: 0,
        windSpeedMaxKmh: 10,
        hazards: [],
      })),
    };

    const leg = legComparison(comparison, 1);

    expect(leg.from.name).toBe('Prague');
    expect(leg.to.name).toBe('Vienna');
    expect(leg.distanceKm).toBe(252);
    expect(leg.options.map((option) => option.mode)).toEqual(['BUS', 'TRAIN']);
    expect(leg.weather.map((item) => item.city)).toEqual(['Prague', 'Vienna']);
    expect(leg.travelers).toBe(comparison.travelers);
    expect(leg.priority).toBe('BALANCED');
    expect(leg.currency).toBe('EUR');
  });
});
