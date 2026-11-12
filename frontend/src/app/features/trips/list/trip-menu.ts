import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { Menu, MenuContent } from '../../../shared/ui/menu';
import { duplicateState } from '../trip-duplicate';

/**
 * The "⋯" menu of a trip: open, edit, duplicate and delete (with its inline confirmation).
 * Built on `Menu`, which stays open while the delete confirmation is answered.
 */
@Component({
  selector: 'app-trip-menu',
  imports: [RouterLink, ConfirmAction, Menu, MenuContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-menu [label]="'Actions for ' + trip().title" placement="beside" [closeOnSelect]="false">
      <svg menuIcon viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3" />
      </svg>
      <ng-template appMenuContent>
        <a [routerLink]="['/trips', trip().id]" [attr.aria-label]="'Open ' + trip().title">Open</a>
        <a [routerLink]="['/trips', trip().id, 'edit']" [attr.aria-label]="'Edit ' + trip().title">
          Edit
        </a>
        <a
          [routerLink]="['/trips', 'new']"
          [state]="duplicateState(trip())"
          [attr.aria-label]="'Duplicate ' + trip().title"
        >
          Duplicate
        </a>
        <app-confirm-action
          [ariaLabel]="'Delete ' + trip().title"
          question="Delete this trip?"
          [busy]="busy()"
          (confirmed)="deleted.emit()"
        />
      </ng-template>
    </app-menu>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    a {
      display: block;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--color-text);
      font-weight: 600;
      text-decoration: none;
    }

    a:hover {
      background: var(--color-selected-bg);
    }

    :host ::ng-deep .button {
      width: 100%;
    }
  `,
})
export class TripMenu {
  readonly trip = input.required<Trip>();
  readonly busy = input(false);
  readonly deleted = output<void>();

  protected readonly duplicateState = duplicateState;
}
