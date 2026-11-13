import { TestBed } from '@angular/core/testing';
import { Comparison, ModeTotals } from '../../../core/api/models';
import { ItineraryView } from './itinerary-view';
import { MULTI_COMPARISON } from './comparison.testing';

describe('ItineraryView', () => {
  async function render(comparison: Comparison): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ItineraryView);
    fixture.componentRef.setInput('comparison', comparison);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** Row headers of the whole-trip table; the recommended row by its plan name. */
  const rows = (view: HTMLElement) =>
    Array.from(view.querySelectorAll('[aria-label="Whole-trip totals"] tbody tr th'), (th) =>
      (th.querySelector('.plan') ?? th).textContent?.trim(),
    );

  it('lists the mixed plan first, then every single-mode alternative', async () => {
    const view = await render(MULTI_COMPARISON);

    expect(rows(view)).toEqual([
      'Train, then bus',
      'Train for every leg',
      'Bus for every leg',
      'Bike for every leg',
    ]);
    expect(view.querySelectorAll('.timeline .leg')).toHaveLength(2);
    expect(view.querySelectorAll('details.leg-details')).toHaveLength(2);
  });

  it('does not repeat a single-mode plan that is already the recommendation', async () => {
    const view = await render({
      ...MULTI_COMPARISON,
      recommendedItinerary: {
        modes: ['BUS', 'BUS'],
        durationMinutes: 570,
        totalCost: 38,
        co2Kg: 15,
      },
    });

    expect(rows(view)).toEqual(['Bus all the way', 'Train for every leg', 'Bike for every leg']);
  });

  it('says so when a leg has no available mode', async () => {
    const view = await render({
      ...MULTI_COMPARISON,
      legs: [
        MULTI_COMPARISON.legs[0],
        {
          ...MULTI_COMPARISON.legs[1],
          recommendedMode: null,
          options: [
            {
              ...MULTI_COMPARISON.legs[1].options[0],
              available: false,
              recommended: false,
              unavailableReason: 'too far',
              unavailableCode: 'TOO_FAR',
            },
          ],
        },
      ],
      recommendedItinerary: null,
    });

    expect(view.querySelector('.leg--blocked')?.textContent).toContain(
      'No transport mode is available on this leg.',
    );
    expect(view.querySelector('tbody')?.textContent).toContain(
      'Not possible: a leg has no available mode.',
    );
    expect(view.querySelector('.leg--blocked')?.textContent).toContain(
      'Bus: too far for this mode',
    );
  });

  describe('modes that cannot be used on every leg', () => {
    const bikeRow = async (code: ModeTotals['unavailableCode'], reason: string) => {
      const view = await render({
        ...MULTI_COMPARISON,
        singleModeTotals: MULTI_COMPARISON.singleModeTotals.map((totals) =>
          totals.mode === 'BIKE'
            ? { ...totals, unavailableCode: code, unavailableReason: reason }
            : totals,
        ),
      });
      const row = Array.from(
        view.querySelectorAll('[aria-label="Whole-trip totals"] tbody tr'),
      ).find((tr) => tr.querySelector('th')?.textContent?.includes('Bike')) as Element;
      return { row, text: row.querySelector('.reason')?.textContent?.replace(/\s+/g, ' ').trim() };
    };

    it.each([
      [
        'DIFFERENT_LANDMASS',
        '⊘ Not available on leg 1 (Berlin to Prague): different continent or island',
      ],
      ['TOO_FAR', '⊘ Not available on leg 1 (Berlin to Prague): too far for this mode'],
    ] as const)('shows %s as plain words with the leg, greyed out', async (code, expected) => {
      const { row, text } = await bikeRow(code, 'Leg 1 (Berlin to Prague): English prose');

      expect(text).toBe(expected);
      expect(row.classList).toContain('unavailable');
    });

    it('falls back to the API reason when there is no code', async () => {
      const { text } = await bikeRow(null, 'Leg 1 (Berlin to Prague): Route is closed');

      expect(text).toBe('⊘ Not available on leg 1 (Berlin to Prague): Route is closed');
    });

    it('shows a reason without a leg prefix as it is', async () => {
      const { text } = await bikeRow(null, 'Not offered');

      expect(text).toBe('⊘ Not available: Not offered');
    });
  });
});
