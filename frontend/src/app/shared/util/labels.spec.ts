import { countdownLabel, durationLabel, travelersLabel } from './labels';

describe('labels', () => {
  it('formats durations in hours and minutes', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(180)).toBe('3 h');
    expect(durationLabel(373)).toBe('6 h 13 min');
  });

  it('describes how far away a departure is', () => {
    expect(countdownLabel(0)).toBe('today');
    expect(countdownLabel(1)).toBe('tomorrow');
    expect(countdownLabel(9)).toBe('in 9 days');
    expect(countdownLabel(-1)).toBe('yesterday');
    expect(countdownLabel(-3)).toBe('3 days ago');
  });

  it('pluralizes travelers', () => {
    expect(travelersLabel(1)).toBe('1 traveler');
    expect(travelersLabel(3)).toBe('3 travelers');
  });
});
