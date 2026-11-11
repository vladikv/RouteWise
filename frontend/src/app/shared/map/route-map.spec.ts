import { ComponentFixture, TestBed } from '@angular/core/testing';
import { City } from '../../core/api/models';
import { RouteMap, RouteSelection } from './route-map';

const BERLIN: City = { id: 3, name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405 };
const VIENNA: City = {
  id: 23,
  name: 'Vienna',
  country: 'AT',
  latitude: 48.2082,
  longitude: 16.3738,
};
const PARIS: City = { id: 18, name: 'Paris', country: 'FR', latitude: 48.8566, longitude: 2.3522 };

describe('RouteMap', () => {
  let fixture: ComponentFixture<RouteMap>;
  let map: HTMLElement;
  let selections: RouteSelection[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, VIENNA, PARIS]);
    selections = [];
    fixture.componentInstance.selectionChange.subscribe((selection) => selections.push(selection));
    map = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function city(name: string): SVGGElement {
    const marker = Array.from(map.querySelectorAll<SVGGElement>('g.city')).find((g) =>
      g.getAttribute('aria-label')?.startsWith(name),
    );
    if (!marker) {
      throw new Error(`No city ${name}`);
    }
    return marker;
  }

  async function select(originId: number | null, destinationId: number | null): Promise<void> {
    fixture.componentRef.setInput('originId', originId);
    fixture.componentRef.setInput('destinationId', destinationId);
    await fixture.whenStable();
  }

  it('renders every city as a labelled, focusable button and prompts for an origin', () => {
    const markers = map.querySelectorAll('g.city');

    expect(markers).toHaveLength(3);
    expect(city('Berlin').getAttribute('role')).toBe('button');
    expect(city('Berlin').getAttribute('tabindex')).toBe('0');
    expect(city('Berlin').getAttribute('aria-pressed')).toBe('false');
    expect(city('Berlin').textContent).toContain('Berlin');
    expect(map.querySelector('[role="status"]')?.textContent).toBe('Choose an origin city.');
    expect(map.querySelector('path.route')).toBeNull();
  });

  it('places cities by their coordinates: Paris west of Berlin, Vienna south of Berlin', () => {
    const x = (name: string) => Number(city(name).querySelector('.city__dot')?.getAttribute('cx'));
    const y = (name: string) => Number(city(name).querySelector('.city__dot')?.getAttribute('cy'));

    expect(x('Paris')).toBeLessThan(x('Berlin'));
    expect(y('Vienna')).toBeGreaterThan(y('Berlin'));
  });

  it('picks the origin first, then the destination', async () => {
    city('Berlin').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: null });

    await select(3, null);
    expect(city('Berlin').getAttribute('aria-pressed')).toBe('true');
    expect(city('Berlin').getAttribute('aria-label')).toBe('Berlin, origin');
    expect(map.querySelector('[role="status"]')?.textContent).toBe(
      'Origin: Berlin. Choose a destination.',
    );

    city('Vienna').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: 23 });
  });

  it('draws the route and states it in text once both cities are chosen', async () => {
    await select(3, 23);

    expect(map.querySelector('path.route')?.getAttribute('d')).toMatch(/^M [\d.]+ [\d.]+ Q /);
    expect(city('Berlin').querySelector('.city__letter')?.textContent?.trim()).toBe('A');
    expect(city('Vienna').querySelector('.city__letter')?.textContent?.trim()).toBe('B');
    expect(city('Vienna').getAttribute('aria-label')).toBe('Vienna, destination');
    expect(map.querySelector('[role="status"]')?.textContent).toBe(
      'Route from Berlin to Vienna, 524 km straight-line.',
    );
  });

  it('starts a new route on a further pick and clears when the origin is picked again', async () => {
    await select(3, 23);
    city('Paris').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 18, destinationId: null });

    await select(3, null);
    city('Berlin').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: null, destinationId: null });
  });

  it('keeps a destination that was chosen before the origin', async () => {
    await select(null, 23);

    city('Berlin').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: 23 });
  });

  it('can be operated with Enter and Space', () => {
    city('Berlin').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(selections.at(-1)).toEqual({ originId: 3, destinationId: null });

    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    city('Paris').dispatchEvent(space);
    expect(selections).toHaveLength(2);
    expect(space.defaultPrevented).toBe(true); // no page scroll
  });

  it('shows a read-only route as one described image when not interactive', async () => {
    fixture.componentRef.setInput('interactive', false);
    await select(3, 23);

    const svg = map.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe(
      'Route from Berlin to Vienna, 524 km straight-line.',
    );
    expect(map.querySelector('[role="button"]')).toBeNull();
    expect(map.querySelector('[role="status"]')).toBeNull();

    map.querySelector('g.city')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selections).toEqual([]);
  });
});
