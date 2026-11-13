import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/** How the Home page is arranged: floating panels over the full map, or a map beside the form. */
export type HomeLayoutChoice = 'map' | 'split';

export const HOME_LAYOUT_STORAGE_KEY = 'routewise.homeLayout';

/** The Map layout needs room for two floating panels, so it is only offered from this width. */
const MAP_QUERY = '(min-width: 1440px)';
/** From this width Split puts the map and the form side by side; below it they are stacked. */
const COLUMNS_QUERY = '(min-width: 1024px)';

/**
 * The user's Home layout choice, remembered in `localStorage` (unavailable or invalid storage
 * means Split). `effective` is what is actually shown: Map only while the viewport is at
 * least 1440 px wide, otherwise Split; falling back never overwrites the saved choice.
 */
@Injectable({ providedIn: 'root' })
export class HomeLayout {
  private readonly document = inject(DOCUMENT);

  readonly preference = signal<HomeLayoutChoice>(this.readStored());
  /** True while the viewport is wide enough for the Map layout (and the choice is offered). */
  readonly mapAvailable = this.watchViewport(MAP_QUERY);
  /** True while Split has room for two columns (otherwise map, form and results are stacked). */
  readonly sideBySide = this.watchViewport(COLUMNS_QUERY);
  readonly effective = computed<HomeLayoutChoice>(() =>
    this.preference() === 'map' && this.mapAvailable() ? 'map' : 'split',
  );

  set(choice: HomeLayoutChoice): void {
    this.preference.set(choice);
    try {
      this.document.defaultView?.localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, choice);
    } catch {
      // Storage may be blocked or full: the choice then lasts for this visit only.
    }
  }

  private readStored(): HomeLayoutChoice {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(HOME_LAYOUT_STORAGE_KEY);
      return stored === 'map' ? 'map' : 'split';
    } catch {
      return 'split';
    }
  }

  private watchViewport(query: string) {
    const list = this.document.defaultView?.matchMedia?.(query);
    if (!list) {
      return signal(false).asReadonly();
    }
    const matches = signal(list.matches);
    const listener = (event: MediaQueryListEvent) => matches.set(event.matches);
    list.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => list.removeEventListener('change', listener));
    return matches.asReadonly();
  }
}
