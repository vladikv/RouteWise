import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TRIP } from '../trip-form.testing';
import { PriorityColumn } from './trip-figures';
import { TripBoard } from './trip-board';

@Component({
  imports: [TripBoard],
  template: `<app-trip-board [columns]="columns()" />`,
})
class Host {
  readonly columns = signal<PriorityColumn[]>([
    {
      priority: 'FASTEST',
      entries: [{ trip: { ...TRIP, priority: 'FASTEST' }, figures: null }],
      count: 1,
      totalCost: 1234,
      currency: 'EUR',
    },
    { priority: 'CHEAPEST', entries: [], count: 0, totalCost: 0, currency: null },
  ]);
}

describe('TripBoard lanes', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function lane(root: HTMLElement, priority: string): HTMLElement {
    return root.querySelector(`[data-priority="${priority}"].column`)!;
  }

  it('shows a colour dot, the name, the count and the total in the lane header', async () => {
    const header = lane(await render(), 'FASTEST').querySelector('.column__head')!;

    expect(header.querySelector('.lane-dot')?.getAttribute('data-lane')).toBe('FASTEST');
    expect(header.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Fastest 1 trip',
    );
    expect(header.querySelector('.column__total')?.textContent).toContain('€1,234 total');
  });

  it('has a "+" link that opens New trip with the lane priority', async () => {
    const root = await render();

    const add = lane(root, 'CHEAPEST').querySelector('a.column__add')!;

    expect(add.getAttribute('aria-label')).toBe('New Cheapest trip');
    expect(add.getAttribute('href')).toBe('/trips/new?priority=CHEAPEST');
    expect(lane(root, 'FASTEST').querySelector('a.column__add')?.getAttribute('href')).toBe(
      '/trips/new?priority=FASTEST',
    );
  });

  it('keeps an empty lane calm: no total, a "No trips" note', async () => {
    const empty = lane(await render(), 'CHEAPEST');

    expect(empty.querySelector('.column__empty')?.textContent).toContain('No trips');
    expect(empty.querySelector('.column__total')).toBeNull();
    expect(empty.querySelector('app-trip-card')).toBeNull();
  });
  it('puts a card in the lane of its priority, with that lane tint', async () => {
    const card = lane(await render(), 'FASTEST').querySelector('app-trip-card article')!;

    expect(card.classList.contains('trip--fastest')).toBe(true);
  });

  it('makes the "+" a focusable link that is reachable by keyboard', async () => {
    const add = lane(await render(), 'FASTEST').querySelector<HTMLAnchorElement>('a.column__add')!;

    add.focus();

    expect(add.tabIndex).toBe(0);
    expect(document.activeElement).toBe(add);
  });
});
