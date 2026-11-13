import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * Keep the key and values in sync with the inline script in `index.html`, which sets
 * `data-theme` before the first paint using the same rules.
 */
export const THEME_STORAGE_KEY = 'routewise.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The user's theme choice (light, dark or follow the system), remembered in `localStorage`.
 * The resolved theme is written to `<html data-theme>` and `color-scheme`; CSS does the rest.
 * Unavailable or invalid storage means "system".
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.(DARK_QUERY) ?? null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.readStored());
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    return preference === 'system' ? (this.systemDark() ? 'dark' : 'light') : preference;
  });

  constructor() {
    this.media?.addEventListener('change', (event) => {
      this.systemDark.set(event.matches);
      this.apply();
    });
    this.apply();
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage may be blocked or full: the choice then lasts for this visit only.
    }
    this.apply();
  }

  private apply(): void {
    const theme = this.resolved();
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  }

  private readStored(): ThemePreference {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return THEME_PREFERENCES.find((preference) => preference === stored) ?? 'system';
    } catch {
      return 'system';
    }
  }
}
