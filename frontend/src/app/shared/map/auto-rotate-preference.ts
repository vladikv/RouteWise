import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export const AUTO_ROTATE_STORAGE_KEY = 'routewise.autoRotate';
/** The key of the earlier "Pause globe rotation" toggle; `'true'` there means the user turned rotation off. */
export const LEGACY_PAUSED_STORAGE_KEY = 'routewise.globePaused';

/**
 * The user's explicit choice for the globe's idle rotation (the "Auto-rotate" toggle), remembered in
 * `localStorage`: `true` on, `false` off, `null` no choice yet. Without a choice the map decides by the
 * motion setting (rotating, unless the user prefers reduced motion). Unavailable or invalid storage
 * means no choice; a failed write lasts for this visit only. An old `routewise.globePaused = 'true'`
 * counts as an explicit "off" (the only place that knows the old key).
 */
@Injectable({ providedIn: 'root' })
export class AutoRotatePreference {
  private readonly document = inject(DOCUMENT);

  readonly choice = signal<boolean | null>(this.readStored());

  set(on: boolean): void {
    this.choice.set(on);
    try {
      this.document.defaultView?.localStorage.setItem(AUTO_ROTATE_STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // Storage may be blocked or full: the choice then lasts for this visit only.
    }
  }

  private readStored(): boolean | null {
    try {
      const storage = this.document.defaultView?.localStorage;
      const stored = storage?.getItem(AUTO_ROTATE_STORAGE_KEY);
      if (stored === 'on' || stored === 'off') {
        return stored === 'on';
      }
      return storage?.getItem(LEGACY_PAUSED_STORAGE_KEY) === 'true' ? false : null;
    } catch {
      return null;
    }
  }
}
