import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { LAND_LOADER, MapTrip, RouteMap } from './route-map';

const BERLIN = makeCity({ id: 3, name: 'Berlin', latitude: 52.52, longitude: 13.405 });
const VIENNA = makeCity({ id: 23, name: 'Vienna', latitude: 48.2082, longitude: 16.3738 });
const PARIS = makeCity({ id: 18, name: 'Paris', latitude: 48.8566, longitude: 2.3522 });
/** On the far side of the globe while it points at Europe. */
const SYDNEY = makeCity({
  id: 50,
  name: 'Sydney',
  latitude: -33.8688,
  longitude: 151.2093,
  continent: 'OCEANIA',
});
const AUCKLAND = makeCity({
  id: 51,
  name: 'Auckland',
  latitude: -36.85,
  longitude: 174.76,
  continent: 'OCEANIA',
});

const TRIPS: MapTrip[] = [
  { id: 7, title: 'Berlin to Vienna', date: '2026-12-01', stops: [3, 23] },
  { id: 8, title: 'Paris round', date: '2027-01-15', stops: [18, 3, 18] },
];

describe('RouteMap trips layer', () => {
  let fixture: ComponentFixture<RouteMap>;
  let host: HTMLElement;

  beforeEach(() => {
    // Reduced motion: no idle turn, views apply at once.
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    TestBed.configureTestingModule({
      providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function render(inputs: Record<string, unknown> = { trips: TRIPS }): Promise<void> {
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, VIENNA, PARIS, SYDNEY, AUCKLAND]);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    host = fixture.nativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const arcs = () => Array.from(host.querySelectorAll('path.trip-arc'));
  const hits = () => Array.from(host.querySelectorAll('path.trip-hit'));
  const toggle = () =>
    host.querySelector('button[aria-label="Show my trips"]') as HTMLButtonElement;
  const tip = () => host.querySelector('.card-tip');

  it('draws one thin arc path per trip, hidden from assistive technology', async () => {
    await render();

    expect(arcs()).toHaveLength(2);
    expect(host.querySelector('g.trip-arcs')?.getAttribute('aria-hidden')).toBe('true');
    expect(arcs()[0].getAttribute('d')).toMatch(/^M[\d.,L-]+$/);
    // The second trip has two legs: two subpaths.
    expect((arcs()[1].getAttribute('d') ?? '').match(/M/g)).toHaveLength(2);
  });

  it('draws nothing, and offers no toggle, without trips', async () => {
    await render({ trips: [] });

    expect(arcs()).toHaveLength(0);
    expect(toggle()).toBeNull();
  });

  it('skips trips behind the globe and trips with unknown cities', async () => {
    await render({
      trips: [
        { id: 1, title: 'Far away', date: '2026-12-01', stops: [50, 51] },
        { id: 2, title: 'Unknown', date: '2026-12-01', stops: [3, 999] },
        TRIPS[0],
      ],
    });

    expect(hits()).toHaveLength(1);
  });

  it('has a labelled toggle with aria-pressed that shows and hides the layer', async () => {
    await render();
    const changes: boolean[] = [];
    fixture.componentInstance.showTrips.subscribe((value) => changes.push(value));

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(toggle().title).toBe('Show my trips');

    toggle().click();
    await settle();

    expect(changes).toEqual([false]);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(arcs()).toHaveLength(0);

    toggle().click();
    await settle();
    expect(arcs()).toHaveLength(2);
  });

  it('starts hidden when told to', async () => {
    await render({ trips: TRIPS, showTrips: false });

    expect(arcs()).toHaveLength(0);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the trip title and date in a tooltip on hover and hides it on leave', async () => {
    await render();

    hits()[0].dispatchEvent(new MouseEvent('pointerenter', { clientX: 300, clientY: 200 }));
    await settle();

    expect(tip()?.textContent).toContain('Berlin to Vienna');
    expect(tip()?.textContent).toContain('Dec 1, 2026');
    expect(tip()?.getAttribute('aria-hidden')).toBe('true');

    hits()[0].dispatchEvent(new MouseEvent('pointerleave'));
    await settle();
    expect(tip()).toBeNull();
  });

  it('opens the trip on a click on its arc, but not at the end of a drag', async () => {
    await render();
    const opened: number[] = [];
    fixture.componentInstance.tripOpen.subscribe((id) => opened.push(id));
    const svg = host.querySelector('svg') as SVGSVGElement;

    hits()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(opened).toEqual([8]);

    svg.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 100, clientY: 100 }));
    svg.dispatchEvent(new MouseEvent('pointermove', { clientX: 160, clientY: 100 }));
    svg.dispatchEvent(new MouseEvent('pointerup'));
    hits()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(opened).toEqual([8]);
  });

  it('marks every stop of a trip with a small dot inside the hidden group', async () => {
    await render();

    const dots = Array.from(host.querySelectorAll('g.trip-arcs circle.trip-stop'));
    expect(dots).toHaveLength(2 + 2); // Berlin and Vienna; Paris and Berlin (the round trip's Paris counts once)
    expect(dots.every((dot) => dot.getAttribute('r') === '3')).toBe(true);
  });

  it('has a hit path on top of each thin arc with the same shape', async () => {
    await render();

    expect(hits().map((hit) => hit.getAttribute('d'))).toEqual(
      arcs().map((arc) => arc.getAttribute('d')),
    );
  });

  it('fades while a route is selected, and stays under the route', async () => {
    await render();
    const group = () => host.querySelector('g.trip-arcs') as SVGGElement;
    expect(group().classList).not.toContain('trip-arcs--faded');

    fixture.componentRef.setInput('originId', BERLIN.id);
    fixture.componentRef.setInput('destinationId', VIENNA.id);
    await settle();

    expect(group().classList).toContain('trip-arcs--faded');
    const nodes = Array.from(host.querySelectorAll('svg > g.trip-arcs, svg > path.route'));
    expect(nodes[0]).toBe(group());
  });

  it('shows no layer on a map that is only an image', async () => {
    await render({ trips: TRIPS, interactive: false });

    expect(arcs()).toHaveLength(0);
  });
});
