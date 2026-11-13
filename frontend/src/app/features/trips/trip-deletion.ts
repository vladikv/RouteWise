import { Injectable, inject, signal } from '@angular/core';
import { ApiError } from '../../core/api/api-error';
import { Trip } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ToastService } from '../../shared/ui/toast';

/** The Undo toast stays shorter than the API's 30 s restore window, so Undo rarely meets a 409. */
export const UNDO_TOAST_MS = 10_000;

/** What the page does once the API has deleted or restored a trip. */
export interface DeletionHooks {
  deleted: (trip: Trip) => void;
  restored: (trip: Trip) => void;
}

/**
 * The delete flow of a page: a trip waits for the confirm dialog (`pending`), the DELETE runs
 * (`busy`, `error` stay in the dialog), then a toast offers Undo (`POST /restore`) for a few
 * seconds and takes keyboard focus, so Undo stays reachable when the deleted trip's button is gone. Provide it in the page that shows the dialog; the toast and the restore outlive the page.
 */
@Injectable()
export class TripDeletion {
  private readonly tripApi = inject(TripApi);
  private readonly toasts = inject(ToastService);

  /** The trip the dialog asks about; null while no dialog is open. */
  readonly pending = signal<Trip | null>(null);
  readonly busy = signal(false);
  /** Why the last DELETE failed, shown in the dialog. */
  readonly error = signal<unknown>(null);

  request(trip: Trip): void {
    this.error.set(null);
    this.pending.set(trip);
  }

  cancel(): void {
    if (!this.busy()) {
      this.pending.set(null);
    }
  }

  confirm(hooks: DeletionHooks): void {
    const trip = this.pending();
    if (!trip || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.tripApi.delete(trip.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.pending.set(null);
        hooks.deleted(trip);
        this.toasts.show({
          kind: 'info',
          message: `Deleted "${trip.title}"`,
          durationMs: UNDO_TOAST_MS,
          focus: true,
          action: { label: 'Undo', run: () => this.restore(trip, hooks) },
        });
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(error);
      },
    });
  }

  private restore(trip: Trip, hooks: DeletionHooks): void {
    this.tripApi.restore(trip.id).subscribe({
      next: () => hooks.restored(trip),
      error: (error: unknown) => {
        const reason = error instanceof ApiError ? error.message : 'Please try again.';
        this.toasts.show({
          kind: 'error',
          message: `Couldn't restore "${trip.title}". ${reason}`,
        });
      },
    });
  }
}
