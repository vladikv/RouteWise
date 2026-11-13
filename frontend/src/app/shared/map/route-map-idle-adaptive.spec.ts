import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { GlobeView } from './globe';
import { LAND_LOADER, RouteMap } from './route-map';

const BERLIN = makeCity({ id: 3, name: 'Berlin', latitude: 52.52, longitude: 13.405 });

/**
 * The idle loop on a clock the spec drives frame by frame: each `frame(gap)` is one animation frame
 * `gap` ms after the previous one, so slow frames can be simulated.
 */
describe('RouteMap idle rotation on slow frames', () => {
  let fixture: ComponentFixture<RouteMap>;
  let pending: FrameRequestCallback[];
  let now: number;

  beforeEach(() => {
    pending = [];
    now = 1000;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      pending.push(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
    });
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN]);
    fixture.componentRef.setInput('autoRotate', true);
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  const longitude = (): number => (fixture.componentInstance['view']() as GlobeView).longitude;

  function frame(gap: number): void {
    now += gap;
    pending.splice(0).forEach((callback) => callback(now));
  }

  /** Frames of `gap` ms until the globe has moved once more; returns how many frames that took. */
  function untilUpdate(gap: number, limit = 50): number {
    const before = longitude();
    for (let frames = 1; frames <= limit; frames++) {
      frame(gap);
      if (longitude() !== before) {
        return frames;
      }
    }
    return limit;
  }

  it('updates about every 50 ms while frames are fast', () => {
    frame(16); // the first frame only starts the clock
    expect(untilUpdate(16)).toBeLessThanOrEqual(4);
    expect(untilUpdate(16)).toBeLessThanOrEqual(4);
  });

  it('backs off after a slow frame, up to every 200 ms', () => {
    frame(100);
    expect(untilUpdate(100)).toBe(1); // 100 ms since the start: an update, and the next frame is slow
    expect(untilUpdate(100)).toBe(2); // so the gap is now 200 ms
  });

  it('goes back to the fast rate when frames are fast again', () => {
    frame(100);
    untilUpdate(100);
    untilUpdate(100);
    untilUpdate(16);
    untilUpdate(16);

    expect(untilUpdate(16)).toBeLessThanOrEqual(4);
  });

  it('switches itself off for the session after 5 slow update frames within 10 s', () => {
    frame(100);
    for (let i = 0; i < 12 && pending.length > 0; i++) {
      untilUpdate(100, 4);
    }

    expect(pending).toHaveLength(0);
    const stopped = longitude();
    frame(5000);
    expect(longitude()).toBe(stopped);

    // Interaction and its 10 s of quiet do not bring it back either.
    (fixture.nativeElement as HTMLElement).dispatchEvent(new Event('pointerenter'));
    (fixture.nativeElement as HTMLElement).dispatchEvent(new Event('pointerleave'));
    expect(pending).toHaveLength(0);
  });

  it('keeps turning when only some update frames are slow', () => {
    frame(16);
    for (let round = 0; round < 3; round++) {
      untilUpdate(16);
      untilUpdate(100); // one slow update frame ...
      for (let i = 0; i < 4; i++) {
        untilUpdate(16); // ... then fast ones: no five slow ones in a row, within 10 s
      }
      expect(pending.length).toBeGreaterThan(0);
    }
    now += 20_000; // slow frames older than the 10 s window do not count
    untilUpdate(100);
    untilUpdate(100);
    expect(pending.length).toBeGreaterThan(0);
  });
});
