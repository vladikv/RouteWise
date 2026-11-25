import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { RouteMap } from './route-map';

const BERLIN = makeCity({
  id: 3,
  name: 'Berlin',
  country: 'DE',
  latitude: 52.52,
  longitude: 13.405,
});
const SYDNEY = makeCity({
  id: 40,
  name: 'Sydney',
  country: 'AU',
  latitude: -33.8688,
  longitude: 151.2093,
});
const HONG_KONG = makeCity({
  id: 41,
  name: 'Hong Kong',
  country: 'HK',
  latitude: 22.3193,
  longitude: 114.1694,
});

describe('RouteMap with a connecting leg', () => {
  let fixture: ComponentFixture<RouteMap>;
  let map: HTMLElement;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, SYDNEY, HONG_KONG]);
    map = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => vi.unstubAllGlobals());

  async function show(hubs: (number | null)[]): Promise<void> {
    fixture.componentRef.setInput('stops', [3, 40]);
    fixture.componentRef.setInput('hubs', hubs);
    await fixture.whenStable();
  }

  const arc = () => map.querySelector('path.route:not(.route--glow):not(.route--flow)');
  const pathPoints = () => (arc()?.getAttribute('d') ?? '').match(/[ML]/g)?.length ?? 0;

  it('marks the hub and draws the leg through it as a longer path than the direct arc', async () => {
    await show([null]);
    const direct = pathPoints();
    expect(map.querySelector('.hub')).toBeNull();

    await show([41]);

    expect(map.querySelectorAll('path.route:not(.route--glow):not(.route--flow)')).toHaveLength(1);
    expect(map.querySelectorAll('.hub')).toHaveLength(1);
    expect(pathPoints()).toBeGreaterThan(direct);
  });

  it('does not make the hub a stop: no pin, no label, still two stops', async () => {
    await show([41]);

    expect(map.querySelectorAll('g.city .city__letter')).toHaveLength(2);
    expect(map.querySelector('[role="status"]')?.textContent).toMatch(
      /^Route Berlin → Sydney, \d+ km straight-line\.$/,
    );
    expect(map.querySelector('.hub')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('ignores a hub id that is not among the cities', async () => {
    await show([999]);

    expect(map.querySelector('.hub')).toBeNull();
  });
});

describe('RouteMap with a connecting leg and motion', () => {
  let frames: FrameRequestCallback[];
  let clock: number;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    frames = [];
    clock = 1000;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  async function setup() {
    const fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, SYDNEY, HONG_KONG]);
    await fixture.whenStable();
    const map = fixture.nativeElement as HTMLElement;
    const longitude = () =>
      Number(map.querySelector('svg[data-longitude]')?.getAttribute('data-longitude'));
    const step = async (elapsed: number) => {
      clock = 1000 + elapsed;
      frames.splice(0).forEach((callback) => callback(clock));
      await fixture.whenStable();
    };
    return { fixture, map, longitude, step };
  }

  it('keeps a turn under way when a comparison without a connection arrives', async () => {
    const { fixture, longitude, step } = await setup();
    fixture.componentRef.setInput('stops', [3, 40]);
    await fixture.whenStable();
    await step(0);
    await step(300);
    const during = longitude();

    fixture.componentRef.setInput('hubs', [null]);
    await fixture.whenStable();

    expect(longitude()).toBe(during); // not snapped to the end
    expect(frames.length).toBeGreaterThan(0); // still turning
    await step(600);
    expect(longitude()).not.toBe(during);
  });

  it('keeps a turn animated when the hub arrives during it', async () => {
    const { fixture, longitude, step } = await setup();
    fixture.componentRef.setInput('stops', [3, 40]);
    await fixture.whenStable();
    await step(0);
    await step(300);
    const during = longitude();

    fixture.componentRef.setInput('hubs', [41]);
    await fixture.whenStable();

    expect(longitude()).toBeCloseTo(during, 0);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('shows the hub mark only once the drawing has reached it', async () => {
    const { fixture, map, step } = await setup();
    fixture.componentRef.setInput('stops', [3, 40]);
    fixture.componentRef.setInput('hubs', [41]);
    await fixture.whenStable();
    await step(0);
    await step(100);
    expect(map.querySelector('.hub')).toBeNull();

    await step(10000);

    expect(map.querySelector('.hub')).not.toBeNull();
  });
});
