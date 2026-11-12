import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { TRIP } from '../trip-form.testing';
import { FigureState, TripFigures } from './trip-figures';
import { TripCard } from './trip-card';

@Component({
  imports: [TripCard],
  template: `<app-trip-card [trip]="trip" [state]="state()" (deleted)="deleted = deleted + 1" />`,
})
class Host {
  readonly trip: Trip = TRIP;
  readonly state = signal<FigureState>({ status: 'loading' });
  deleted = 0;
}

function ready(overrides: Partial<TripFigures> = {}): FigureState {
  return {
    status: 'ready',
    figures: {
      currency: 'EUR',
      cost: 150.8,
      co2Kg: 44,
      carCo2Kg: 115.7,
      mode: 'TRAIN',
      modes: ['TRAIN'],
      ...overrides,
    },
  };
}

describe('TripCard', () => {
  async function render(state: FigureState): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.state.set(state);
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

  it('shows a busy placeholder while loading and an untinted card', async () => {
    const card = await render({ status: 'loading' });

    expect(card.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(card.querySelector('.trip__value')).toBeNull();
    expect(card.classList.contains('trip--lime')).toBe(false);
  });

  it('says so when the figures failed or no route exists', async () => {
    expect((await render({ status: 'failed' })).textContent).toContain('Figures unavailable');
    TestBed.resetTestingModule();
    expect((await render({ status: 'ready', figures: null })).textContent).toContain(
      'No available route',
    );
  });
});
