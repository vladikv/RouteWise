import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Trip } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { PRIORITY_LABELS, travelersLabel } from '../../shared/util/labels';

/** All saved trips, soonest departure first, with edit and delete. */
@Component({
  selector: 'app-trip-list-page',
  imports: [DatePipe, RouterLink, ConfirmAction, ErrorMessage, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-list-page.html',
  styleUrl: './trip-list-page.scss',
})
export class TripListPage {
  private readonly tripApi = inject(TripApi);

  protected readonly trips = rxResource({ stream: () => this.tripApi.findAll() });
  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteError = signal<unknown>(null);
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly travelersLabel = travelersLabel;

  protected delete(trip: Trip): void {
    this.deletingId.set(trip.id);
    this.deleteError.set(null);
    this.tripApi.delete(trip.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.trips.update((list) => list?.filter((item) => item.id !== trip.id));
      },
      error: (error: unknown) => {
        this.deletingId.set(null);
        this.deleteError.set(error);
      },
    });
  }
}
