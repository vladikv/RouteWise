import {
  countdownLabel,
  durationLabel,
  travelersLabel,
  unavailableText,
  unavailableTotalsText,
} from './labels';

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

  it('words why a mode is unavailable, falling back to the API reason', () => {
    expect(unavailableText('DIFFERENT_LANDMASS', 'x')).toBe(
      'Not available: different continent or island',
    );
    expect(unavailableText('TOO_FAR', null)).toBe('Not available: too far for this mode');
    expect(unavailableText(null, 'Route of 5 km')).toBe('Not available: Route of 5 km');
    expect(unavailableText(null, null)).toBe('Not available');
  });

  it('keeps the leg in a single-mode reason', () => {
    expect(unavailableTotalsText('TOO_FAR', 'Leg 2 (A to B): prose')).toBe(
      'Not available on leg 2 (A to B): too far for this mode',
    );
    expect(unavailableTotalsText(null, 'Leg 2 (A to B): prose')).toBe(
      'Not available on leg 2 (A to B): prose',
    );
    expect(unavailableTotalsText('TOO_FAR', 'no prefix')).toBe(
      'Not available: too far for this mode',
    );
  });
});
