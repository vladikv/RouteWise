import { TestBed } from '@angular/core/testing';
import { LayoutBreakpoint } from './layout-breakpoint';

type Listener = (event: MediaQueryListEvent) => void;

/** Replaces window.matchMedia with a fake driven by a viewport width. */
function mockViewport(initialWidth: number) {
  const lists: { query: string; listeners: Set<Listener> }[] = [];
  const matches = (query: string, width: number) =>
    width >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1]);
  let width = initialWidth;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const entry = { query, listeners: new Set<Listener>() };
      lists.push(entry);
      return {
        get matches() {
          return matches(query, width);
        },
        addEventListener: (_: string, listener: Listener) => entry.listeners.add(listener),
        removeEventListener: (_: string, listener: Listener) => entry.listeners.delete(listener),
      };
    }),
  );
  return {
    resize(next: number) {
      width = next;
      for (const { query, listeners } of lists) {
        listeners.forEach((listener) =>
          listener({ matches: matches(query, next) } as MediaQueryListEvent),
        );
      }
    },
    listenerCount: () => lists.reduce((sum, { listeners }) => sum + listeners.size, 0),
  };
}

describe('LayoutBreakpoint', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports the layout for the viewport width and follows resizes', () => {
    const viewport = mockViewport(375);
    const breakpoint = TestBed.inject(LayoutBreakpoint);
    expect(breakpoint.layout()).toBe('narrow');

    viewport.resize(768);
    expect(breakpoint.layout()).toBe('medium');

    viewport.resize(1279);
    expect(breakpoint.layout()).toBe('medium');

    viewport.resize(1280);
    expect(breakpoint.layout()).toBe('wide');
  });

  it('reports desktop from 1024 px', () => {
    const viewport = mockViewport(1023);
    const breakpoint = TestBed.inject(LayoutBreakpoint);
    expect(breakpoint.desktop()).toBe(false);

    viewport.resize(1024);
    expect(breakpoint.desktop()).toBe(true);
  });

  it('stops listening when destroyed', () => {
    const viewport = mockViewport(1400);
    TestBed.inject(LayoutBreakpoint);
    expect(viewport.listenerCount()).toBe(3);

    TestBed.resetTestingModule();
    expect(viewport.listenerCount()).toBe(0);
  });

  it('falls back to the stacked layout without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const breakpoint = TestBed.inject(LayoutBreakpoint);
    expect(breakpoint.layout()).toBe('medium');
    expect(breakpoint.desktop()).toBe(false);
  });
});
