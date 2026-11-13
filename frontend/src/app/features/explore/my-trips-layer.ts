import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export const MY_TRIPS_LAYER_STORAGE_KEY = 'routewise.myTripsLayer';

/**
 * Whether Home draws the user's upcoming trips on the globe, remembered in `localStorage`
 * (default on; unavailable or invalid storage means on, and a failed write lasts for this visit).
 */
@Injectable({ providedIn: 'root' })
export class MyTripsLayer {
  private readonly document = inject(DOCUMENT);

  readonly visible = signal(this.readStored());

  set(visible: boolean): void {
    this.visible.set(visible);
    try {
      this.document.defaultView?.localStorage.setItem(MY_TRIPS_LAYER_STORAGE_KEY, String(visible));
    } catch {
      // Storage may be blocked or full: the choice then lasts for this visit only.
    }
  }

  private readStored(): boolean {
    try {
      return (
        this.document.defaultView?.localStorage.getItem(MY_TRIPS_LAYER_STORAGE_KEY) !== 'false'
      );
    } catch {
      return true;
    }
  }
}
