import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { RouteMap } from './route-map';

const BERLIN = makeCity({ id: 3, name: 'Berlin', latitude: 52.52, longitude: 13.405 });
const PRAGUE = makeCity({ id: 18, name: 'Prague', latitude: 50.0755, longitude: 14.4378 });
const VIENNA = makeCity({ id: 23, name: 'Vienna', latitude: 48.2082, longitude: 16.3738 });

describe('RouteMap on a saved route (not pickable, one leg in focus)', () => {
  let fixture: ComponentFixture<RouteMap>;
  let map: HTMLElement;
  let picked: number[];

  beforeEach(async () => {
    // Reduced motion: every move of the globe is instant.
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, PRAGUE, VIENNA]);
    fixture.componentRef.setInput('stops', [3, 18, 23]);
    fixture.componentRef.setInput('pickable', false);
    picked = [];
    fixture.componentInstance.cityPick.subscribe((id) => picked.push(id));
    map = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  const svg = () => map.querySelector<SVGSVGElement>('svg.map')!;
  const lines = () =>
    Array.from(map.querySelectorAll('path.route:not(.route--glow):not(.route--flow)'));
  const longitude = () => Number(svg().getAttribute('data-longitude'));

  it('stays navigable but draws the cities as marks, not buttons', () => {
    expect(svg().getAttribute('role')).toBe('group');
    expect(svg().getAttribute('tabindex')).toBe('0');
    expect(svg().getAttribute('aria-label')).toMatch(
      /^Route Berlin → Prague → Vienna, \d+ km straight-line\. Drag or use the arrow keys/,
    );
    expect(map.querySelector('[role="button"]')).toBeNull();
    expect(map.querySelectorAll('g.city--static')).toHaveLength(3);
    expect(map.querySelector('button[aria-label="Zoom in"]')).not.toBeNull();
  });

  it('ignores clicks on a city', async () => {
    map.querySelector('g.city')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    expect(picked).toEqual([]);
  });

  it('draws every leg evenly without a focused leg', () => {
    expect(lines()).toHaveLength(2);
    expect(map.querySelector('.route--dimmed, .route--focused')).toBeNull();
  });

  it('makes the focused leg heavier and fades the others, and evens them out again', async () => {
    fixture.componentRef.setInput('focusLeg', 1);
    await fixture.whenStable();

    expect(lines().map((line) => line.getAttribute('class'))).toEqual([
      'route route--dimmed',
      'route route--focused',
    ]);

    fixture.componentRef.setInput('focusLeg', null);
    await fixture.whenStable();
    expect(map.querySelector('.route--dimmed, .route--focused')).toBeNull();
  });

  it('turns the globe to a focused leg that is out of view, and leaves a visible one alone', async () => {
    const start = longitude();
    fixture.componentRef.setInput('focusLeg', 0);
    await fixture.whenStable();
    expect(longitude()).toBe(start);

    for (let i = 0; i < 40; i++) {
      svg().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    }
    await fixture.whenStable();
    const turned = longitude();
    expect(Math.abs(turned - start)).toBeGreaterThan(90);

    fixture.componentRef.setInput('focusLeg', 1);
    await fixture.whenStable();

    // Prague to Vienna is around 15° east.
    expect(Math.abs(longitude() - 15.4)).toBeLessThan(5);
  });
});
