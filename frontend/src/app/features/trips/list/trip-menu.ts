import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip, TripPriority } from '../../../core/api/models';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { Menu, MenuContent } from '../../../shared/ui/menu';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { duplicateState } from '../trip-duplicate';
import { moveTargets } from './trip-move';

/**
 * The "⋯" menu of a trip: open, edit, duplicate, move to another priority and delete (with its
 * inline confirmation).
 * Built on `Menu`, which stays open while the delete confirmation is answered.
 */
@Component({
  selector: 'app-trip-menu',
  imports: [RouterLink, ConfirmAction, Menu, MenuContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-menu
      [label]="'Actions for ' + trip().title"
      placement="beside"
      [closeOnSelect]="false"
      [(open)]="open"
    >
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
        <div class="move" role="group" aria-label="Change priority">
          @for (priority of targets(); track priority) {
            <button type="button" class="move__item" (click)="move(priority)">
              Move to {{ priorityLabels[priority] }}
            </button>
          }
        </div>
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
      text-align: left;
      text-decoration: none;
    }

    .move {
      display: grid;
      margin-top: var(--space-1);
      padding-top: var(--space-1);
      border-top: 1px solid var(--glass-border);
    }

    a:hover,
    .move__item:hover {
      background: var(--color-selected-bg);
    }

    .move__item {
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--color-text);
      font: inherit;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
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
  readonly moved = output<TripPriority>();

  protected readonly open = signal(false);
  protected readonly targets = computed(() => moveTargets(this.trip().priority));
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly duplicateState = duplicateState;

  protected move(priority: TripPriority): void {
    this.open.set(false);
    this.moved.emit(priority);
  }
}
