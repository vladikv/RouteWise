import { addDaysIso, daysBetween, todayIso } from './date';

describe('todayIso', () => {
  it('formats the local date with zero padding', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 10, 11, 0, 0))).toBe('2026-11-11');
  });
});

describe('addDaysIso', () => {
  it('moves across month and year boundaries', () => {
    expect(addDaysIso('2026-11-11', 7)).toBe('2026-11-18');
    expect(addDaysIso('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('counts whole days, negative for earlier dates', () => {
    expect(daysBetween('2026-11-11', '2026-11-20')).toBe(9);
    expect(daysBetween('2026-11-11', '2026-11-11')).toBe(0);
    expect(daysBetween('2026-11-11', '2026-11-08')).toBe(-3);
    // Across the October daylight-saving change the count must stay whole.
    expect(daysBetween('2026-10-20', '2026-10-30')).toBe(10);
  });
});
