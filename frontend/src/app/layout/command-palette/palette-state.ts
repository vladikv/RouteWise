import { Injectable, signal } from '@angular/core';

/** Whether the search palette is open; the header, the rail and Ctrl/Cmd + K all open the same one. */
@Injectable({ providedIn: 'root' })
export class PaletteState {
  private readonly opened = signal(false);
  readonly isOpen = this.opened.asReadonly();

  open(): void {
    this.opened.set(true);
  }

  close(): void {
    this.opened.set(false);
  }
}
