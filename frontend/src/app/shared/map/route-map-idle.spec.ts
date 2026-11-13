import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { GlobeView } from './globe';
import { IDLE_ROTATION_STORAGE_KEY } from './idle-rotation-preference';
import { LAND_LOADER, RouteMap } from './route-map';

const BERLIN = makeCity({ id: 3, name: 'Berlin', latitude: 52.52, longitude: 13.405 });
const VIENNA = makeCity({ id: 23, name: 'Vienna', latitude: 48.2082, longitude: 16.3738 });

const RESUME_MS = 10_000;

describe('RouteMap idle rotation', () => {
  let fixture: ComponentFixture<RouteMap>;
  let host: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    TestBed.configureTestingModule({
      providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'hidden');
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function render(inputs: Record<string, unknown> = { autoRotate: true }): void {
    fixture = TestBed.createComponent(RouteMap);
    fixture.componentRef.setInput('cities', [BERLIN, VIENNA]);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  const view = (): GlobeView => fixture.componentInstance['view']();
  const longitude = (): number => view().longitude;
  const svg = (): Element => host.querySelector('svg') as Element;
  const wheel = () => new WheelEvent('wheel', { deltaY: -10, cancelable: true });

  /** Runs the clock and reports how far the globe turned meanwhile (degrees east, 0 to 360, across the antimeridian too). */
  function turnedDuring(ms: number): number {
    const before = longitude();
    vi.advanceTimersByTime(ms);
    return (before - longitude() + 360) % 360;
  }

  function dispatch(target: Element, event: Event): void {
    target.dispatchEvent(event);
    fixture.detectChanges();
  }

  it('turns a full circle in about two minutes while nothing is selected', () => {
    render();

    expect(turnedDuring(60_000)).toBeCloseTo(180, 0);
    expect(turnedDuring(60_000)).toBeCloseTo(180, 0);
  });

  it('does not turn unless asked to', () => {
    render({});

    expect(turnedDuring(5000)).toBe(0);
  });

  it('keeps latitude and zoom', () => {
    render();
    const before = view();

    vi.advanceTimersByTime(5000);

    expect(view().latitude).toBe(before.latitude);
    expect(view().zoom).toBe(before.zoom);
  });

  it('stops at once while the pointer is over the map and stays still however long it rests there', () => {
    render();
    vi.advanceTimersByTime(1000);

    dispatch(host, new Event('pointerenter'));

    expect(turnedDuring(RESUME_MS * 3)).toBe(0);
  });

  it('resumes 10 s after the pointer leaves, not before', () => {
    render();
    dispatch(host, new Event('pointerenter'));
    dispatch(host, new Event('pointerleave'));

    expect(turnedDuring(RESUME_MS - 100)).toBe(0);
    expect(turnedDuring(1000)).toBeGreaterThan(0);
  });

  const interactions: [string, () => Event][] = [
    ['a wheel turn', wheel],
    ['a key press', () => new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })],
    ['a drag start', () => new MouseEvent('pointerdown', { button: 0, bubbles: true })],
  ];

  it.each(interactions)('stops at once on %s and resumes 10 s after it', (_, event) => {
    render();
    vi.advanceTimersByTime(500);

    dispatch(svg(), event());

    expect(turnedDuring(RESUME_MS - 100)).toBe(0);
    expect(turnedDuring(1000)).toBeGreaterThan(0);
  });

  it('stops on a zoom button and on Reset view', () => {
    render();
    for (const label of ['Zoom in', 'Reset view']) {
      vi.advanceTimersByTime(RESUME_MS + 500);
      const button = host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

      button.click();
      fixture.detectChanges();
      vi.advanceTimersByTime(800); // the button's own animation

      expect(turnedDuring(1000)).toBe(0);
    }
  });

  it('restarts the 10 s of quiet with every interaction', () => {
    render();
    dispatch(svg(), wheel());
    vi.advanceTimersByTime(RESUME_MS - 1000);

    dispatch(svg(), wheel());

    expect(turnedDuring(RESUME_MS - 100)).toBe(0);
    expect(turnedDuring(1000)).toBeGreaterThan(0);
  });

  it('stops while a route is selected and waits 10 s of quiet after it is cleared', () => {
    render();
    fixture.componentRef.setInput('originId', BERLIN.id);
    fixture.componentRef.setInput('destinationId', VIENNA.id);
    fixture.detectChanges();
    vi.advanceTimersByTime(800); // the turn to the route

    expect(turnedDuring(RESUME_MS * 2)).toBe(0);

    fixture.componentRef.setInput('originId', null);
    fixture.componentRef.setInput('destinationId', null);
    fixture.detectChanges();
    vi.advanceTimersByTime(800); // the turn back to Europe

    const waiting = longitude();
    vi.advanceTimersByTime(RESUME_MS - 1800);
    expect(longitude()).toBe(waiting);
    expect(turnedDuring(3000)).toBeGreaterThan(0);
  });

  it('does not turn under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render();

    expect(turnedDuring(5000)).toBe(0);
  });

  it('follows the reduced-motion setting while the page is open', () => {
    let listener: (event: { matches: boolean }) => void = () => undefined;
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: (_: string, callback: typeof listener) => (listener = callback),
      removeEventListener: () => undefined,
    }));
    render();
    expect(turnedDuring(1000)).toBeGreaterThan(0);

    listener({ matches: true });
    fixture.detectChanges();

    expect(turnedDuring(1000)).toBe(0);
  });

  it('pauses while the tab is hidden and goes on when it is shown again', () => {
    render();
    const hide = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    hide(true);
    expect(turnedDuring(5000)).toBe(0);

    hide(false);
    expect(turnedDuring(1000)).toBeGreaterThan(0);
  });

  it('does not turn when the map is only an image', () => {
    render({ autoRotate: true, interactive: false });

    expect(turnedDuring(5000)).toBe(0);
  });

  it('leaves nothing running once destroyed', () => {
    render();
    dispatch(host, new Event('pointerenter'));
    dispatch(host, new Event('pointerleave'));

    fixture.destroy();

    expect(vi.getTimerCount()).toBe(0);
  });

  describe('keyboard focus', () => {
    const city = () => host.querySelector('g.city[aria-label^="Berlin"]') as SVGGElement;

    it('never resumes while focus is inside the map, so a focused city stays in view', () => {
      render();
      city().focus();
      fixture.detectChanges();
      const before = longitude();

      vi.advanceTimersByTime(RESUME_MS * 3);

      expect(longitude()).toBe(before);
      expect(document.activeElement).toBe(city());
    });

    it('resumes 10 s after focus has left the map, not when it moves within it', () => {
      render();
      city().focus();
      fixture.detectChanges();

      dispatch(host, new FocusEvent('focusout', { bubbles: true, relatedTarget: svg() }));
      expect(turnedDuring(RESUME_MS * 2)).toBe(0);

      dispatch(host, new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
      expect(turnedDuring(RESUME_MS - 100)).toBe(0);
      expect(turnedDuring(1000)).toBeGreaterThan(0);
    });
  });

  describe('pause control', () => {
    const pause = () =>
      host.querySelector('button[aria-label="Pause globe rotation"]') as HTMLButtonElement | null;

    it('is shown where the globe idles, with a fixed label and the state in aria-pressed', () => {
      render();

      expect(pause()?.getAttribute('aria-label')).toBe('Pause globe rotation');
      expect(pause()?.getAttribute('aria-pressed')).toBe('false');
    });

    it('is not shown without autoRotate, on an image or under reduced motion', () => {
      render({});
      expect(pause()).toBeNull();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
      });
      vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
      render();
      expect(pause()).toBeNull();
    });

    it('pauses at once and for good, and resuming turns again at once', () => {
      render();

      pause()?.click();
      fixture.detectChanges();
      expect(pause()?.getAttribute('aria-label')).toBe('Pause globe rotation');
      expect(pause()?.getAttribute('aria-pressed')).toBe('true');
      expect(turnedDuring(RESUME_MS * 3)).toBe(0);

      pause()?.click();
      fixture.detectChanges();
      expect(pause()?.getAttribute('aria-pressed')).toBe('false');
      vi.advanceTimersByTime(RESUME_MS + 500); // the click itself counts as an interaction
      expect(turnedDuring(1000)).toBeGreaterThan(0);
    });

    it('remembers the choice', () => {
      render();
      pause()?.click();
      expect(localStorage.getItem(IDLE_ROTATION_STORAGE_KEY)).toBe('true');
      fixture.destroy();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
      });

      render();

      expect(pause()?.getAttribute('aria-pressed')).toBe('true');
      expect(turnedDuring(5000)).toBe(0);
    });

    it('rotates by default when the stored value is invalid or the storage fails', () => {
      localStorage.setItem(IDLE_ROTATION_STORAGE_KEY, 'maybe');
      render();
      expect(pause()?.getAttribute('aria-pressed')).toBe('false');
      fixture.destroy();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('full');
      });

      render();
      expect(turnedDuring(1000)).toBeGreaterThan(0);
      pause()?.click();
      fixture.detectChanges();

      expect(pause()?.getAttribute('aria-pressed')).toBe('true');
      expect(turnedDuring(2000)).toBe(0);
    });
  });
});
