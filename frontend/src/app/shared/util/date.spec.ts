import { todayIso } from './date';

describe('todayIso', () => {
  it('formats the local date with zero padding', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 10, 11, 0, 0))).toBe('2026-11-11');
  });
});
