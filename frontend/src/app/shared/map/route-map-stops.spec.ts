import { ComponentFixture, TestBed } from '@angular/core/testing';
import { City } from '../../core/api/models';
import { RouteMap, RouteSelection } from './route-map';

const BERLIN: City = { id: 3, name: 'Berlin', country: 'DE', latitude: 52.52, longitude: 13.405 };
const PRAGUE: City = {
  id: 18,
  name: 'Prague',
  country: 'CZ',
  latitude: 50.0755,
  longitude: 14.4378,
};
const VIENNA: City = {
  id: 23,
  name: 'Vienna',
  country: 'AT',
  latitude: 48.2082,
  longitude: 16.3738,
};

describe('RouteMap with stops', () => {
  let fixture: ComponentFixture<RouteMap>;
  let map: HTMLElement;
  let picked: number[];
  let selections: RouteSelection[];

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, PRAGUE, VIENNA]);
    picked = [];
    selections = [];
    fixture.componentInstance.cityPick.subscribe((id) => picked.push(id));
    fixture.componentInstance.selectionChange.subscribe((selection) => selections.push(selection));
    map = fixture.nativeElement as HTMLElement;
  });

  async function show(stops: number[]): Promise<void> {
    fixture.componentRef.setInput('stops', stops);
    await fixture.whenStable();
  }

  function city(name: string): SVGGElement {
    const marker = Array.from(map.querySelectorAll<SVGGElement>('g.city')).find((g) =>
      g.getAttribute('aria-label')?.startsWith(name),
    );
    if (!marker) {
      throw new Error(`No city ${name}`);
    }
    return marker;
  }

  it('numbers the stops in order and describes the whole route', async () => {
    await show([3, 18, 23]);

    expect(city('Berlin').getAttribute('aria-label')).toBe('Berlin, stop 1');
    expect(city('Prague').getAttribute('aria-label')).toBe('Prague, stop 2');
    expect(city('Vienna').getAttribute('aria-label')).toBe('Vienna, stop 3');
    expect(city('Prague').querySelector('.city__letter')?.textContent?.trim()).toBe('2');
    expect(map.querySelector('[role="status"]')?.textContent).toMatch(
      /^Route Berlin → Prague → Vienna, \d+ km straight-line\.$/,
    );
    expect(map.querySelectorAll('path.route:not(.route--halo)')).toHaveLength(1);
  });

  it('shows every visit of a city in its pin on a round trip', async () => {
    await show([3, 23, 3]);

    expect(city('Berlin').querySelector('.city__letter')?.textContent?.trim()).toBe('1, 3');
    expect(city('Berlin').getAttribute('aria-label')).toBe('Berlin, stop 1, 3');
  });

  it('reports a picked city instead of changing origin and destination', async () => {
    await show([3]);

    city('Vienna').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    city('Berlin').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(picked).toEqual([23, 3]);
    expect(selections).toEqual([]);
    expect(map.querySelector('[role="status"]')?.textContent).toBe(
      'Stop 1: Berlin. Add another stop.',
    );
  });
});
