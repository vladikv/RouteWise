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
          unavailableGroups: [
            {
              code: 'TOO_FAR',
              modes: ['BUS', 'TRAIN'],
              message: 'Too far between Prague and Vienna for: bus, train',
            },
          ],
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
      'Too far between Prague and Vienna for: bus, train',
    );
  });

  describe('modes that cannot be used on every leg', () => {
    const NOTES = ':scope > p.muted:has([aria-hidden])';
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/\s+/g, ' ').trim();

    const bikeRow = async (code: ModeTotals['unavailableCode'], reason: string | null) => {
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
      return { view, row };
    };

    it.each(['DIFFERENT_LANDMASS', 'TOO_FAR', null] as const)(
      'says only "Not available" in the row for code %s, greyed out',
      async (code) => {
        const { row } = await bikeRow(code, 'Leg 1 (Berlin to Prague): English prose');

        expect(text(row.querySelector('.reason'))).toBe('⊘ Not available');
        expect(row.classList).toContain('unavailable');
        expect(row.textContent).not.toContain('English prose');
      },
    );

    it("shows the comparison's group messages under the totals table", async () => {
      const { view } = await bikeRow('TOO_FAR', null);

      expect(Array.from(view.querySelectorAll(NOTES), text)).toEqual([
        '⊘ Not possible for the whole trip: bike (too far between Berlin and Prague)',
      ]);
    });

    it('shows one note per group', async () => {
      const view = await render({
        ...MULTI_COMPARISON,
        unavailableGroups: [
          { code: 'TOO_FAR', modes: ['BIKE'], message: 'First reason' },
          { code: 'DIFFERENT_LANDMASS', modes: ['CAR'], message: 'Second reason' },
        ],
      });

      expect(Array.from(view.querySelectorAll(NOTES), text)).toEqual([
        '⊘ First reason',
        '⊘ Second reason',
      ]);
    });

    it('shows no note without groups', async () => {
      const view = await render({ ...MULTI_COMPARISON, unavailableGroups: [] });

      expect(view.querySelectorAll(NOTES)).toHaveLength(0);
    });
  });
});
