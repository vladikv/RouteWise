import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Trip } from '../../core/api/models';
import { Dialog } from '../../shared/ui/dialog';
import { ErrorMessage } from '../../shared/ui/error-message';

/** "Delete trip?" for the trip given (open while there is one); a failed DELETE shows inside it. */
@Component({
  selector: 'app-trip-delete-dialog',
  imports: [Dialog, ErrorMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog
      title="Delete trip?"
      confirmLabel="Delete"
      [open]="trip() !== null"
      [busy]="busy()"
      [fallbackFocus]="fallbackFocus()"
      (confirmed)="confirmed.emit()"
      (cancelled)="cancelled.emit()"
    >
      <p>“{{ trip()?.title }}” will be removed from your trips. You can undo it right after.</p>
      @if (error(); as failure) {
        <app-error-message [error]="failure" [retryable]="false" />
      }
    </app-dialog>
  `,
})
export class TripDeleteDialog {
  readonly trip = input<Trip | null>(null);
  readonly busy = input(false);
  /** Gets focus when the trip's own button is gone after the delete. */
  readonly fallbackFocus = input<HTMLElement | null>(null);
  readonly error = input<unknown>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
