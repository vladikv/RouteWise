import { duplicateState, presetFromState } from './trip-duplicate';
import { TRIP } from './trip-form.testing';

const TODAY = '2026-11-12';

describe('duplicateState', () => {
  it('copies the trip fields, marks the title and keeps every stop', () => {
    const trip = {
      ...TRIP,
      stops: [...TRIP.stops, { cityId: 18, cityName: 'Prague', country: 'CZ', position: 2 }],
    };

    expect(duplicateState(trip, TODAY)).toEqual({
      draft: {
        title: 'Berlin to Vienna (copy)',
        stops: [3, 23, 18],
        departureDate: '2099-05-20',
        travelers: 2,
        priority: 'GREENEST',
        notes: 'Window seat',
      },
    });
  });

  it('keeps a date of today, drops a past one and turns missing notes into text', () => {
    expect(duplicateState({ ...TRIP, departureDate: TODAY }, TODAY).draft.departureDate).toBe(
      TODAY,
    );
    expect(
      duplicateState({ ...TRIP, departureDate: '2026-11-11' }, TODAY).draft.departureDate,
    ).toBe('');
    expect(duplicateState({ ...TRIP, notes: null }, TODAY).draft.notes).toBe('');
  });

  it('keeps the copy title within 100 characters', () => {
    const title = duplicateState({ ...TRIP, title: 'x'.repeat(100) }, TODAY).draft.title;

    expect(title).toHaveLength(100);
    expect(title.endsWith(' (copy)')).toBe(true);
  });
});

describe('presetFromState', () => {
  it('turns a duplicate draft back into a preset', () => {
    expect(presetFromState(duplicateState(TRIP, TODAY), TODAY)).toEqual({
      title: 'Berlin to Vienna (copy)',
      stops: [3, 23],
      departureDate: '2099-05-20',
      travelers: 2,
      priority: 'GREENEST',
      notes: 'Window seat',
    });
  });

  it.each([
    undefined,
    null,
    'x',
    42,
    {},
    { draft: null },
    { draft: 'x' },
    { draft: [] },
    { draft: {} },
  ])('ignores a state without a usable draft: %j', (state) => {
    expect(presetFromState(state, TODAY)).toBeNull();
  });

  it('drops fields that are not valid and keeps the others', () => {
    const preset = presetFromState(
      {
        draft: {
          title: 7,
          stops: [3, 'x'],
          departureDate: '2020-01-01',
          travelers: 99,
          priority: 'LUXURY',
          notes: 'ok',
        },
      },
      TODAY,
    );

    expect(preset).toEqual({ notes: 'ok' });
  });
});
