import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeCity } from '../../core/api/city.testing';
import { GlobeView } from './globe';
import { AUTO_ROTATE_STORAGE_KEY, LEGACY_PAUSED_STORAGE_KEY } from './auto-rotate-preference';
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

  /** The default 640 x 620 drawing: the disc is centred at (320, 310) with radius 288; the test DOM has no layout, so the map sits at (0, 0). */
  const onDisc = { clientX: 320, clientY: 310 };
  const besideDisc = { clientX: 8, clientY: 8 };
  const pointer = (type: string, at: { clientX: number; clientY: number }) =>
    new MouseEvent(type, at);

  it('stops at once while the pointer is over the globe and stays still however long it rests there', () => {
    render();
    vi.advanceTimersByTime(1000);

    dispatch(host, pointer('pointerenter', onDisc));

    expect(turnedDuring(RESUME_MS * 3)).toBe(0);
  });

  it('keeps turning while the pointer is on the map beside the globe (the map is larger than the disc)', () => {
    render();

    dispatch(host, pointer('pointerenter', besideDisc));
    dispatch(host, pointer('pointermove', { clientX: 630, clientY: 610 }));

    expect(turnedDuring(5000)).toBeGreaterThan(0);
  });

  it('keeps turning in a map that fills a much larger stage, with the pointer on its empty area', () => {
    render({ autoRotate: true, fill: true, insetStart: 300, insetEnd: 300 });

    dispatch(host, pointer('pointerenter', besideDisc));

    expect(turnedDuring(5000)).toBeGreaterThan(0);
  });

  it('stops when the pointer moves onto the globe and starts the 10 s when it moves off it', () => {
    render();
    dispatch(host, pointer('pointerenter', besideDisc));

    dispatch(host, pointer('pointermove', onDisc));
    expect(turnedDuring(RESUME_MS * 2)).toBe(0);

    dispatch(host, pointer('pointermove', besideDisc));
    expect(turnedDuring(RESUME_MS - 100)).toBe(0);
    expect(turnedDuring(1000)).toBeGreaterThan(0);
  });

  it('resumes 10 s after the pointer leaves the map, not before', () => {
    render();
    dispatch(host, pointer('pointerenter', onDisc));
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

  const reducedMotion = (matches: boolean) => {
    let listener: (event: { matches: boolean }) => void = () => undefined;
    vi.stubGlobal('matchMedia', () => ({
      matches,
      addEventListener: (_: string, callback: typeof listener) => (listener = callback),
      removeEventListener: () => undefined,
    }));
    return (value: boolean) => listener({ matches: value });
  };

  it('does not turn by default under prefers-reduced-motion', () => {
    reducedMotion(true);
    render();

    expect(turnedDuring(5000)).toBe(0);
  });

  it('follows the reduced-motion setting while the page is open, as long as the user chose nothing', () => {
    const change = reducedMotion(false);
    render();
    expect(turnedDuring(1000)).toBeGreaterThan(0);

    change(true);
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
    dispatch(host, pointer('pointerenter', onDisc));
    dispatch(host, new Event('pointerleave'));

    fixture.destroy();

    expect(vi.getTimerCount()).toBe(0);
  });

  describe('focus', () => {
    const city = () => host.querySelector('g.city[aria-label^="Berlin"]') as SVGGElement;
    /** jsdom has no focus heuristics: say whether the focus that arrives counts as keyboard focus. */
    function focusVisible(keyboard: boolean): void {
      const matches = Element.prototype.matches;
      vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector) {
        return selector === ':focus-visible' ? keyboard : matches.call(this, selector);
      });
    }

    it('keyboard focus never lets the globe resume, so a focused city stays in view', () => {
      focusVisible(true);
      render();
      city().focus();
      fixture.detectChanges();
      const before = longitude();

      vi.advanceTimersByTime(RESUME_MS * 3);

      expect(longitude()).toBe(before);
      expect(document.activeElement).toBe(city());
    });

    it('keyboard focus resumes 10 s after it has left the map, not when it moves within it', () => {
      focusVisible(true);
      render();
      city().focus();
      fixture.detectChanges();

      dispatch(host, new FocusEvent('focusout', { bubbles: true, relatedTarget: svg() }));
      expect(turnedDuring(RESUME_MS * 2)).toBe(0);

      dispatch(host, new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
      expect(turnedDuring(RESUME_MS - 100)).toBe(0);
      expect(turnedDuring(1000)).toBeGreaterThan(0);
    });

    it('a focus left by a pointer click does not block: it resumes 10 s after the pointer has left', () => {
      focusVisible(false);
      render();
      dispatch(host, pointer('pointerenter', onDisc));
      city().focus(); // the click's focus
      fixture.detectChanges();
      dispatch(host, new Event('pointerleave'));

      expect(document.activeElement).toBe(city());
      expect(turnedDuring(RESUME_MS - 100)).toBe(0);
      expect(turnedDuring(1000)).toBeGreaterThan(0);
    });
  });

  describe('Auto-rotate toggle', () => {
    const toggle = () =>
      host.querySelector('button[aria-label="Auto-rotate"]') as HTMLButtonElement | null;
    const icon = () => toggle()?.querySelector('path')?.getAttribute('d');
    const PLAY = 'M8 5l11 7-11 7z';
    const PAUSE = 'M9 5v14M15 5v14';

    it('is on by default: a fixed label and tooltip, aria-pressed true, a pause icon', () => {
      render();

      expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
      expect(toggle()?.title).toBe('Auto-rotate');
      expect(icon()).toBe(PAUSE);
      expect(turnedDuring(1000)).toBeGreaterThan(0);
    });

    it('is off by default under reduced motion, still shown, with a play icon', () => {
      reducedMotion(true);
      render();

      expect(toggle()?.getAttribute('aria-pressed')).toBe('false');
      expect(icon()).toBe(PLAY);
      expect(turnedDuring(5000)).toBe(0);
    });

    it('turning it on under reduced motion makes the globe rotate, and it is saved', () => {
      reducedMotion(true);
      render();

      toggle()?.click();
      fixture.detectChanges();

      expect(localStorage.getItem(AUTO_ROTATE_STORAGE_KEY)).toBe('on');
      expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
      vi.advanceTimersByTime(RESUME_MS + 500); // the click itself counts as an interaction
      expect(turnedDuring(1000)).toBeGreaterThan(0);
    });

    it('turns rotation off at once and keeps it off, and the choice is saved', () => {
      render();

      toggle()?.click();
      fixture.detectChanges();

      expect(localStorage.getItem(AUTO_ROTATE_STORAGE_KEY)).toBe('off');
      expect(toggle()?.getAttribute('aria-pressed')).toBe('false');
      expect(icon()).toBe(PLAY);
      expect(turnedDuring(RESUME_MS * 3)).toBe(0);
    });

    it('an explicit off survives a reload and beats the default', () => {
      localStorage.setItem(AUTO_ROTATE_STORAGE_KEY, 'off');
      render();

      expect(toggle()?.getAttribute('aria-pressed')).toBe('false');
      expect(turnedDuring(5000)).toBe(0);
    });

    it('an explicit on beats prefers-reduced-motion', () => {
      localStorage.setItem(AUTO_ROTATE_STORAGE_KEY, 'on');
      reducedMotion(true);
      render();

      expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
      expect(turnedDuring(5000)).toBeGreaterThan(0);
    });

    it('treats an old "paused" flag as an explicit off', () => {
      localStorage.setItem(LEGACY_PAUSED_STORAGE_KEY, 'true');
      render();

      expect(toggle()?.getAttribute('aria-pressed')).toBe('false');
      expect(turnedDuring(5000)).toBe(0);
    });

    it('falls back to the default for an invalid value or failing storage, and still toggles', () => {
      localStorage.setItem(AUTO_ROTATE_STORAGE_KEY, 'maybe');
      render();
      expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
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
      toggle()?.click();
      fixture.detectChanges();

      expect(toggle()?.getAttribute('aria-pressed')).toBe('false');
      expect(turnedDuring(2000)).toBe(0);
    });

    it('is not shown without autoRotate or on an image', () => {
      render({});
      expect(toggle()).toBeNull();
      fixture.destroy();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: LAND_LOADER, useValue: () => Promise.resolve({ LAND_RINGS: [] }) }],
      });
      render({ autoRotate: true, interactive: false });
      expect(toggle()).toBeNull();
    });
  });

  it('exposes the angle of the globe for checks from outside', () => {
    render();
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();

    expect(Number(svg().getAttribute('data-longitude'))).toBeCloseTo(longitude(), 1);
  });
});
