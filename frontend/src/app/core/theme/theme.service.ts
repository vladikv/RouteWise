import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'routewise.theme';

/**
 * Light/dark theme. Follows the operating system until the user picks one;
 * the choice is remembered in localStorage and applied as `data-theme` on <html>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemPrefersDark =
    this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

  /** The user's explicit choice; null means "follow the system". */
  private readonly preference = signal<Theme | null>(this.readStored());

  readonly theme = computed<Theme>(
    () => this.preference() ?? (this.systemPrefersDark ? 'dark' : 'light'),
  );

  constructor() {
    effect(() => {
      const preference = this.preference();
      const root = this.document.documentElement;
      if (preference) {
        root.setAttribute('data-theme', preference);
      } else {
        root.removeAttribute('data-theme');
      }
    });
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.preference.set(next);
    this.store(next);
  }

  private readStored(): Theme | null {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null; // storage blocked (private mode): fall back to the system theme
    }
  }

  private store(theme: Theme): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // storage blocked: the choice still applies for this visit
    }
  }
}
