import { durationLabel, travelersLabel } from './labels';

describe('labels', () => {
  it('formats durations in hours and minutes', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(180)).toBe('3 h');
    expect(durationLabel(373)).toBe('6 h 13 min');
  });

  it('pluralizes travelers', () => {
    expect(travelersLabel(1)).toBe('1 traveler');
    expect(travelersLabel(3)).toBe('3 travelers');
  });
});
