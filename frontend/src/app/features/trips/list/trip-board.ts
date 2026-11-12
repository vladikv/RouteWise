import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Trip } from '../../../core/api/models';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { PriorityColumn } from './trip-figures';
import { TripCard } from './trip-card';

/**
 * Trips as one column per priority, cards stacked. On narrow screens the columns
 * scroll sideways in a focusable region.
 */
@Component({
  selector: 'app-trip-board',
  imports: [CurrencyPipe, TripCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="board" tabindex="0" role="region" aria-label="Trips by priority">
      @for (column of columns(); track column.priority) {
        <section class="column" [attr.aria-labelledby]="'column-' + column.priority">
          <h2 class="column__title" [id]="'column-' + column.priority">
            {{ priorityLabels[column.priority] }}
            <span class="column__count">
              {{ column.count }}<span class="visually-hidden"> trips</span>
            </span>
          </h2>
          @if (column.currency) {
            <p class="column__total muted">
              {{ column.totalCost | currency: column.currency : 'symbol' : '1.0-0' }} total
            </p>
          }
          @if (column.count === 0) {
            <p class="column__empty muted">No trips</p>
          } @else {
            <ul class="column__list">
              @for (entry of column.entries; track entry.trip.id) {
                <li>
                  <app-trip-card
                    [trip]="entry.trip"
                    [state]="entry.state"
                    [deleting]="deletingId() === entry.trip.id"
                    (deleted)="deleted.emit(entry.trip)"
                  />
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .board {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(16rem, 82%);
      gap: var(--space-4);
      padding-bottom: var(--space-2);
      overflow-x: auto;
      scroll-snap-type: x proximity;
    }

    .column {
      min-width: 0;
      scroll-snap-align: start;
    }

    .column__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: 1.125rem;
    }

    .column__count {
      padding: 0 var(--space-2);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      font-size: 0.875rem;
    }

    .column__total,
    .column__empty {
      margin: 0 0 var(--space-3);
      font-size: 0.875rem;
    }

    .column__list {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    @media (min-width: 64rem) {
      .board {
        grid-auto-columns: minmax(0, 1fr);
        overflow-x: visible;
      }
    }
  `,
})
export class TripBoard {
  readonly columns = input.required<PriorityColumn[]>();
  readonly deletingId = input<number | null>(null);
  readonly deleted = output<Trip>();

  protected readonly priorityLabels = PRIORITY_LABELS;
}
