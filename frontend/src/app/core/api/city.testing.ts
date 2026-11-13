import { City } from './models';

/** A European city fixture; override what a test cares about. */
export function makeCity(overrides: Partial<City> & Pick<City, 'id' | 'name'>): City {
  return {
    country: 'DE',
    latitude: 50,
    longitude: 10,
    continent: 'EUROPE',
    landmass: 'EURASIA',
    capital: false,
    labelRank: 1,
    ...overrides,
  };
}
