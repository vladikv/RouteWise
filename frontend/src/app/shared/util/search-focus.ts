import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/**
 * "Search trips" shortcut: goes to the Trips page and asks its search field to take focus.
 * The request stays pending until the toolbar consumes it, so it works whether the page is
 * already open or still loading its chunk. A refused navigation (login guard) leaves nothing pending.
 */
@Injectable({ providedIn: 'root' })
export class SearchFocus {
  private readonly router = inject(Router);
  private readonly requested = signal(false);

  /** True while a request waits for the search field. */
  readonly pending = this.requested.asReadonly();

  open(): void {
    void this.router.navigateByUrl('/trips').then(() => {
      if (this.router.url.split(/[?#]/)[0] === '/trips') {
        this.requested.set(true);
      }
    });
  }

  consume(): void {
    this.requested.set(false);
  }
}
