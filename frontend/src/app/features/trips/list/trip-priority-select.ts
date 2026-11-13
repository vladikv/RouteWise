import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Trip, TripPriority } from '../../../core/api/models';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { BOARD_PRIORITIES } from './trip-figures';

/**
 * A compact select that gives a trip another priority right in its list row. It only reports the
 * choice: the page applies it optimistically and rolls it back on failure, and this select
 * follows the trip's priority from its input either way.
 */
@Component({
  selector: 'app-trip-priority-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="picker">
      <span class="lane-dot" [attr.data-lane]="trip().priority" aria-hidden="true"></span>
      <select [attr.aria-label]="'Priority of ' + trip().title" (change)="choose($event)">
        @for (priority of priorities; track priority) {
          <option [value]="priority" [selected]="priority === trip().priority">
            {{ labels[priority] }}
          </option>
        }
      </select>
    </span>
  `,
  styles: `
    .picker {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding-left: var(--space-3);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      box-shadow: var(--glass-highlight);
    }

    select {
      min-height: 2rem;
      padding: 0 var(--space-3) 0 0;
      border: 0;
      background: none;
      color: var(--color-text);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
    }

    @media (pointer: coarse) {
      select {
        min-height: 2.75rem;
      }
    }

    option {
      background: var(--color-surface);
      color: var(--color-text);
    }
  `,
})
export class TripPrioritySelect {
  readonly trip = input.required<Trip>();
  readonly changed = output<TripPriority>();

  protected readonly priorities = BOARD_PRIORITIES;
  protected readonly labels = PRIORITY_LABELS;

  protected choose(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.changed.emit(select.value as TripPriority);
    select.value = this.trip().priority;
  }
}
