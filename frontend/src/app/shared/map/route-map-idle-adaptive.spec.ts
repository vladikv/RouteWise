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
  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  /** The frames waiting to run (Angular's own scheduler uses the stub too). */
  const pending = {
    get length(): number {
      return queue.size;
    },
  };
  let now: number;

  beforeEach(async () => {
    queue.clear();
    now = 1000;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queue.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
    TestBed.configureTestingModule({
      providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
    });
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN]);
    fixture.componentRef.setInput('autoRotate', true);
    fixture.detectChanges();
    await fixture.whenStable(); // the land is drawn
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const longitude = (): number => (fixture.componentInstance['view']() as GlobeView).longitude;

  function frame(gap: number): void {
    now += gap;
    const callbacks = [...queue.values()];
    queue.clear();
    callbacks.forEach((callback) => callback(now));
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

  /** Fast frames up to just before the 3 s warm-up of the running loop is over (no sample is taken yet). */
  function warmUp(): void {
    for (let i = 0; i < 187; i++) {
      frame(16);
    }
  }

  /** One call per update frame: true = the frame after that update is slow, false = fast. */
  function updates(pattern: boolean[]): void {
    for (const slow of pattern) {
      untilUpdate(slow ? 100 : 16, 8);
    }
    untilUpdate(16, 8); // measures the last one
  }

  const slowShare = (slow: number, fast: number): boolean[] => [
    ...Array<boolean>(fast).fill(false),
    ...Array<boolean>(slow).fill(true),
  ];

  it('ignores slow frames during the warm-up and is still turning after it', () => {
    frame(100);
    while (now < 1000 + 2500) {
      untilUpdate(100, 4); // start-up jank: every update frame is slow
    }
    expect(pending.length).toBeGreaterThan(0);

    for (let i = 0; i < 200; i++) {
      frame(16);
    }

    expect(pending.length).toBeGreaterThan(0);
    expect(untilUpdate(16, 8)).toBeLessThanOrEqual(4);
  });

  it('does not count slow frames before the land is drawn', async () => {
    TestBed.resetTestingModule();
    queue.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: LAND_LOADER, useValue: () => new Promise(() => undefined) }],
    });
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN]);
    fixture.componentRef.setInput('autoRotate', true);
    fixture.detectChanges();

    frame(100);
    for (let i = 0; i < 60; i++) {
      untilUpdate(100, 4);
    }

    expect(pending.length).toBeGreaterThan(0);
  });

  it('switches itself off for the session when 60 % of the last 20 update frames are slow', () => {
    frame(16);
    warmUp();
    updates(slowShare(13, 7));

    expect(pending).toHaveLength(0);
    const stopped = longitude();
    frame(5000);
    expect(longitude()).toBe(stopped);

    // Interaction and its 10 s of quiet do not bring it back either.
    (fixture.nativeElement as HTMLElement).dispatchEvent(new Event('pointerenter'));
    (fixture.nativeElement as HTMLElement).dispatchEvent(new Event('pointerleave'));
    expect(pending).toHaveLength(0);
  });

  it('keeps turning when less than 60 % of the last 20 are slow', () => {
    frame(16);
    warmUp();
    updates(slowShare(11, 9));

    expect(pending.length).toBeGreaterThan(0);
  });

  it('starts the warm-up and the samples afresh when the loop restarts after an interaction', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    frame(16);
    warmUp();
    updates(slowShare(15, 0)); // 15 slow samples, not yet 20

    (fixture.nativeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a' }),
    );
    expect(pending).toHaveLength(0);
    vi.advanceTimersByTime(10_000);
    expect(pending.length).toBeGreaterThan(0);

    warmUp();
    updates(slowShare(5, 0)); // would be 20 slow ones if the old samples had been kept

    expect(pending.length).toBeGreaterThan(0);
  });

  it('keeps turning when only some update frames are slow', () => {
    frame(16);
    for (let round = 0; round < 3; round++) {
      untilUpdate(16);
      untilUpdate(100); // one slow update frame ...
      for (let i = 0; i < 4; i++) {
        untilUpdate(16); // ... then fast ones
      }
      expect(pending.length).toBeGreaterThan(0);
    }
    untilUpdate(100);
    untilUpdate(100);
    expect(pending.length).toBeGreaterThan(0);
  });
});
