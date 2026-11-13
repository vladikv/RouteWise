import { homeFieldFor, homeQueryFor } from './home-target';

describe('home target', () => {
  it('fills From when Home is not open or has no From', () => {
    expect(homeFieldFor(null)).toBe('from');
    expect(homeFieldFor({})).toBe('from');
    expect(homeFieldFor({ to: '23' })).toBe('from');
    expect(homeQueryFor(3, null)).toEqual({ from: 3 });
  });

  it('fills To once Home has a From, keeping the rest of its state', () => {
    expect(homeFieldFor({ from: '3' })).toBe('to');
    expect(homeQueryFor(23, { from: '3', date: '2026-12-01', travelers: '2' })).toEqual({
      from: '3',
      to: 23,
      date: '2026-12-01',
      travelers: '2',
    });
    expect(homeQueryFor(5, { from: '3', to: '23' })).toEqual({ from: '3', to: 5 });
  });
});
