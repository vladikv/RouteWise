import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TripApi } from '../../core/api/trip-api';
import { ConfirmAction } from '../../shared/ui/confirm-action';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { PRIORITY_LABELS, travelersLabel } from '../../shared/util/labels';

/** One trip with its details, and edit and delete actions. */
@Component({
  selector: 'app-trip-details-page',
  imports: [DatePipe, RouterLink, ConfirmAction, ErrorMessage, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-details-page.html',
  styleUrl: './trip-details-page.scss',
})
export class TripDetailsPage {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly tripApi = inject(TripApi);
  private readonly router = inject(Router);

  protected readonly trip = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.tripApi.findById(Number(id)),
  });
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<unknown>(null);
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly travelersLabel = travelersLabel;

  protected delete(): void {
    this.deleting.set(true);
    this.deleteError.set(null);
    this.tripApi.delete(Number(this.id())).subscribe({
      next: () => void this.router.navigate(['/trips']),
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deleteError.set(error);
      },
    });
  }
}
