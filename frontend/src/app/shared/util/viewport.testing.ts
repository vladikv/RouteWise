type Listener = (event: MediaQueryListEvent) => void;

/**
 * Replaces `window.matchMedia` with a fake driven by a viewport width (it understands
 * `min-width` queries only). Call `restore()` in `afterEach`.
 */
export function mockViewport(initialWidth: number) {
  const lists: { query: string; listeners: Set<Listener> }[] = [];
  const matches = (query: string, width: number) =>
    width >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1]);
  let width = initialWidth;
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => {
    const entry = { query, listeners: new Set<Listener>() };
    lists.push(entry);
    return {
      get matches() {
        return matches(query, width);
      },
      addEventListener: (_: string, listener: Listener) => entry.listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => entry.listeners.delete(listener),
    };
  }) as unknown as typeof window.matchMedia;
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
    restore() {
      window.matchMedia = original;
    },
  };
}
