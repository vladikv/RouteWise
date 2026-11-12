import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

/** Page layouts: phone (< 768 px), tablet / small laptop (768–1279 px), desktop (≥ 1280 px). */
export type PageLayout = 'narrow' | 'medium' | 'wide';

const WIDE_QUERY = '(min-width: 1280px)';
const MEDIUM_QUERY = '(min-width: 768px)';

/**
 * The current page layout as a signal, kept up to date from `matchMedia`.
 * Without `matchMedia` (server, some test environments) it reports `medium`,
 * the plain stacked layout.
 */
@Injectable({ providedIn: 'root' })
export class LayoutBreakpoint {
  private readonly wide = this.watch(WIDE_QUERY);
  private readonly medium = this.watch(MEDIUM_QUERY);

  readonly layout = computed<PageLayout>(() =>
    this.wide() ? 'wide' : this.medium() ? 'medium' : 'narrow',
  );

  private watch(query: string) {
    const view = inject(DOCUMENT).defaultView;
    const list = view?.matchMedia?.(query);
    if (!list) {
      return signal(query === MEDIUM_QUERY).asReadonly();
    }
    const matches = signal(list.matches);
    const listener = (event: MediaQueryListEvent) => matches.set(event.matches);
    list.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => list.removeEventListener('change', listener));
    return matches.asReadonly();
  }
}
