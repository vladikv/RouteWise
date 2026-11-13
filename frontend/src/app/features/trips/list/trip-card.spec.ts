import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { addDaysIso, todayIso } from '../../../shared/util/date';
import { TRIP } from '../trip-form.testing';
import { TripFigures } from './trip-figures';
import { TripCard } from './trip-card';

@Component({
  imports: [TripCard],
  template: `<app-trip-card
    [trip]="trip()"
    [figures]="figures()"
    (deleted)="deleted = deleted + 1"
  />`,
})
class Host {
  readonly trip = signal<Trip>(TRIP);
  readonly figures = signal<TripFigures | null>(null);
  deleted = 0;
}

/** Figures as the API delivers them: the car share and percentage derive from the two CO2 values. */
function ready(overrides: Partial<TripFigures> = {}): TripFigures {
  const base = { co2Kg: 44, carCo2Kg: 115.7 as number | null, ...overrides };
  const hasCar = base.carCo2Kg !== null && base.carCo2Kg > 0;
  return {
    currency: 'EUR',
    cost: 150.8,
    co2Kg: base.co2Kg,
    carCo2Kg: base.carCo2Kg,
    co2VsCarPercent: hasCar ? Math.round((base.co2Kg / base.carCo2Kg! - 1) * 100) : null,
    co2ShareOfCar: hasCar ? Math.min(base.co2Kg / base.carCo2Kg!, 1) : null,
    mode: 'TRAIN',
    modes: ['TRAIN'],
    legModes: ['TRAIN'],
    ...overrides,
  };
}

describe('TripCard', () => {
  async function render(figures: TripFigures | null, trip: Trip = TRIP): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.figures.set(figures);
    fixture.componentInstance.trip.set(trip);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('article')!;
  }

  it('shows the date, a linked title, the stops, cost, CO2 and the mode in text', async () => {
    const card = await render(ready());

    expect(card.textContent).toContain('May 20, 2099');
    expect(card.querySelector('h3 a')?.getAttribute('href')).toBe('/trips/7');
    expect(card.querySelector('.trip__stops')?.textContent).toMatch(/Berlin\s*→\s*to\s*Vienna/);
    expect(card.querySelector('.trip__value')?.textContent).toContain('€151');
    expect(card.textContent).toContain('44 kg CO₂');
    expect(card.querySelector('.trip__mode')?.textContent).toContain('Train');
  });

  it.each([
    ['TRAIN', 'trip--lime'],
    ['BIKE', 'trip--lime'],
    ['PLANE', 'trip--amber'],
  ] as const)('tints a %s trip with %s', async (mode, tintClass) => {
    const card = await render(ready({ mode, modes: [mode] }));

    expect(card.classList.contains(tintClass)).toBe(true);
  });

  it.each(['CAR', 'BUS'] as const)('leaves a %s trip untinted', async (mode) => {
    const card = await render(ready({ mode, modes: [mode] }));

    expect(card.classList.contains('trip--lime')).toBe(false);
    expect(card.classList.contains('trip--amber')).toBe(false);
  });

  it('names a mixed plan, lists its modes and leaves it untinted', async () => {
    const card = await render(ready({ mode: 'MIXED', modes: ['TRAIN', 'PLANE'] }));

    expect(card.querySelector('.trip__mode')?.textContent).toContain('Mixed: train, plane');
    expect(card.querySelectorAll('.trip__mode app-mode-icon')).toHaveLength(2);
    expect(card.classList.contains('trip--lime')).toBe(false);
    expect(card.classList.contains('trip--amber')).toBe(false);
  });

  it('says so and leaves the card untinted when no route is available', async () => {
    const card = await render(null);

    expect(card.textContent).toContain('No available route');
    expect(card.querySelector('.trip__value')).toBeNull();
    expect(card.classList.contains('trip--lime')).toBe(false);
    expect(card.classList.contains('trip--amber')).toBe(false);
  });

  it('opens the trip from the whole card: one link, no other tab stop for it', async () => {
    const card = await render(ready());

    const links = card.querySelectorAll('a[href="/trips/7"]');
    expect(links[0]).toBe(card.querySelector('h3 a'));
    expect(card.querySelectorAll('h3 a')).toHaveLength(1);
  });

  it('offers open, edit, duplicate and delete as quick actions, and the menu trigger', async () => {
    const card = await render(ready());
    const actions = card.querySelector('app-trip-actions')!;

    expect(
      actions.querySelector('a[aria-label="Open Berlin to Vienna"]')?.getAttribute('href'),
    ).toBe('/trips/7');
    expect(
      actions.querySelector('a[aria-label="Edit Berlin to Vienna"]')?.getAttribute('href'),
    ).toBe('/trips/7/edit');
    expect(
      actions.querySelector('a[aria-label="Duplicate Berlin to Vienna"]')?.getAttribute('href'),
    ).toBe('/trips/new');
    expect(actions.querySelector('button[aria-label="Delete Berlin to Vienna"]')).not.toBeNull();
    expect(card.querySelector('button[aria-label="Actions for Berlin to Vienna"]')).not.toBeNull();
  });

  it('asks before deleting from the quick action and emits only on confirmation', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.figures.set(ready());
    await fixture.whenStable();
    const card = (fixture.nativeElement as HTMLElement).querySelector('article')!;

    card.querySelector<HTMLButtonElement>('app-trip-actions button[aria-label^="Delete"]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.deleted).toBe(0);
    expect(card.querySelector('app-trip-actions')?.textContent).toContain('Delete this trip?');

    const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('app-trip-actions button'));
    buttons.find((button) => button.textContent?.includes('Cancel'))!.click();
    await fixture.whenStable();
    expect(card.querySelector('app-trip-actions')?.textContent).not.toContain('Delete this trip?');

    card.querySelector<HTMLButtonElement>('app-trip-actions button[aria-label^="Delete"]')!.click();
    await fixture.whenStable();
    card.querySelector<HTMLButtonElement>('app-trip-actions .button--danger')!.click();
    expect(fixture.componentInstance.deleted).toBe(1);
  });

  it('draws a dot per stop and the recommended mode of each leg, hidden from assistive tech', async () => {
    const trip: Trip = {
      ...TRIP,
      stops: [...TRIP.stops, { cityId: 18, cityName: 'Prague', country: 'CZ', position: 2 }],
    };
    const card = await render(
      ready({ mode: 'MIXED', modes: ['TRAIN', 'PLANE'], legModes: ['TRAIN', 'PLANE'] }),
      trip,
    );

    const route = card.querySelector('app-trip-route')!;
    expect(route.getAttribute('aria-hidden')).toBe('true');
    expect(route.querySelectorAll('.dot')).toHaveLength(3);
    expect(route.querySelectorAll('app-mode-icon')).toHaveLength(2);
    expect(card.querySelector('.trip__stops')?.textContent).toMatch(
      /Berlin\s*→\s*to\s*Vienna\s*→\s*to\s*Prague/,
    );
  });

  it('draws only the dots when no route is available', async () => {
    const card = await render(null);

    expect(card.querySelectorAll('app-trip-route .dot')).toHaveLength(2);
    expect(card.querySelectorAll('app-trip-route app-mode-icon')).toHaveLength(0);
  });

  it.each([
    [0, 'today'],
    [1, 'tomorrow'],
    [21, 'in 21 days'],
    [-3, '3 days ago'],
  ])('shows the countdown for a trip %i days away as "%s"', async (days, text) => {
    const card = await render(ready(), { ...TRIP, departureDate: addDaysIso(todayIso(), days) });

    expect(card.querySelector('.trip__countdown')?.textContent?.trim()).toBe(text);
  });

  it('compares the CO2 with the car: a bar and the saving in text', async () => {
    const card = await render(ready({ co2Kg: 61, carCo2Kg: 323 }));

    expect(card.querySelector('.trip__bar-fill')?.getAttribute('style')).toContain('18.');
    expect(card.querySelector('.trip__bar-note')?.textContent).toContain('−81 % vs 323 kg by car');
    expect(card.querySelector('.trip__bar-fill--no-saving')).toBeNull();
  });

  it('keeps the bar gray when the plan emits more than the car', async () => {
    const card = await render(ready({ co2Kg: 108, carCo2Kg: 95 }));

    expect(card.querySelector('.trip__bar-fill--no-saving')).not.toBeNull();
    expect(card.querySelector('.trip__bar-note')?.textContent).toContain('+14 % vs 95 kg by car');
  });

  it('says "same as by car" with a gray bar when the plan is the car', async () => {
    const card = await render(ready({ co2Kg: 66, carCo2Kg: 66 }));

    expect(card.querySelector('.trip__bar-fill--no-saving')).not.toBeNull();
    expect(card.querySelector('.trip__bar-note')?.textContent?.trim()).toBe('Same CO₂ as by car');
  });

  it('says so, without a bar, when there is no car figure', async () => {
    const card = await render(ready({ carCo2Kg: null }));

    expect(card.querySelector('.trip__bar')).toBeNull();
    expect(card.querySelector('.trip__bar-note')?.textContent).toContain('No car comparison');
  });
});
