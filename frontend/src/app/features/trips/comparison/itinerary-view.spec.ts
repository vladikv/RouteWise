import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Comparison, ModeTotals } from '../../../core/api/models';
import { ItineraryView } from './itinerary-view';
import { MULTI_COMPARISON } from './comparison.testing';

describe('ItineraryView', () => {
  async function render(comparison: Comparison): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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
    expect(view.querySelector('.leg--blocked')?.textContent).toContain(
      'Try the route with a stop in between, for example a city with an airport.',
    );
  });

  it('names the hub ("Plane via Hong Kong", with the connection spoken) for a connecting recommended flight', async () => {
    const [first, second] = MULTI_COMPARISON.legs;
    const via = { cityId: 41, cityName: 'Hong Kong', airportCode: 'HKG' };
    const view = await render({
      ...MULTI_COMPARISON,
      legs: [
        {
          ...first,
          recommendedMode: 'PLANE',
          options: [{ ...first.options[0], mode: 'PLANE', via }],
        },
        second,
      ],
    });
    const names = Array.from(view.querySelectorAll('.leg__mode'), (item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(names[0]).toContain('Plane, one connection via Hong Kong');
    expect(names[1]).not.toContain('via');
  });

  it('marks a leg priced from a live flight and says so in the summary', async () => {
    const [first, second] = MULTI_COMPARISON.legs;
    const view = await render({
      ...MULTI_COMPARISON,
      legs: [
        {
          ...first,
          options: first.options.map((option) =>
            option.recommended
              ? { ...option, costSource: 'LIVE' as const, costRetrievedAt: '2026-11-20T09:30:00Z' }
              : option,
          ),
        },
        second,
      ],
    });

    expect(view.querySelectorAll('.leg__live')).toHaveLength(1);
    expect(view.querySelector('.leg__live')?.textContent).toBe('(live price)');
    expect(view.querySelector('.summary')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'costs are estimates, except flights marked as live prices (Google Flights).',
    );
  });

  it('says plainly that costs are estimates when no price is live', async () => {
    const view = await render(MULTI_COMPARISON);

    expect(view.querySelector('.leg__live')).toBeNull();
    expect(view.querySelector('.summary')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'costs are estimates.',
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

  it("links each leg's priority line to the trip's edit page", async () => {
    const view = await render(MULTI_COMPARISON);
    const links = Array.from(view.querySelectorAll('.priority-note a'));

    expect(links.length).toBe(MULTI_COMPARISON.legs.length);
    expect(
      links.every((link) => link.getAttribute('href') === `/trips/${MULTI_COMPARISON.tripId}/edit`),
    ).toBe(true);
  });
});
