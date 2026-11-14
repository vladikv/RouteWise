import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export const IDLE_ROTATION_STORAGE_KEY = 'routewise.globePaused';

/**
 * Whether the user paused the globe's idle rotation (the pause control, WCAG 2.2.2), remembered in
 * `localStorage`. Default: rotating; unavailable or invalid storage means rotating, and a failed
 * write lasts for this visit only.
 */
@Injectable({ providedIn: 'root' })
export class IdleRotationPreference {
  private readonly document = inject(DOCUMENT);

  readonly paused = signal(this.readStored());

  set(paused: boolean): void {
    this.paused.set(paused);
    try {
      this.document.defaultView?.localStorage.setItem(IDLE_ROTATION_STORAGE_KEY, String(paused));
    } catch {
      // Storage may be blocked or full: the choice then lasts for this visit only.
    }
  }

  private readStored(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(IDLE_ROTATION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
