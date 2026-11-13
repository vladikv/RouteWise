import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip, TripPriority } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { TripEntry, figuresOf, modeSummary } from './trip-figures';
import { DEFAULT_SORT, SortKey, TripSort, sortTrips, toggleSort } from './trip-filters';
import { TripActions } from './trip-actions';
import { TripMenu } from './trip-menu';
import { TripMove } from './trip-move';

/**
 * Trips as a compact table, one row each, sortable by date, cost and CO₂ (the header buttons;
 * `aria-sort` on the active header cell). The whole row opens the trip: the title link is
 * stretched over it. On narrow screens the date, route, mode and CO₂ columns fold into a second
 * line under the title.
 */
@Component({
  selector: 'app-trip-table',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, ModeIcon, TripActions, TripMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-table.html',
  styleUrl: './trip-table.scss',
})
export class TripTable {
  readonly entries = input.required<TripEntry[]>();
  readonly deletingId = input<number | null>(null);
  readonly movingIds = input<ReadonlySet<number>>(new Set());
  readonly sort = model<TripSort>(DEFAULT_SORT);
  readonly deleted = output<Trip>();
  readonly moved = output<TripMove>();

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly figuresOf = figuresOf;
  protected readonly modeSummary = modeSummary;
  protected readonly rows = computed(() => sortTrips(this.entries(), this.sort()));

  protected move(trip: Trip, priority: TripPriority): void {
    this.moved.emit({ trip, priority, focus: true });
  }

  protected sortBy(key: SortKey): void {
    this.sort.update((current) => toggleSort(current, key));
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const { key: active, direction } = this.sort();
    if (active !== key) {
      return 'none';
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  protected arrow(key: SortKey): string {
    const { key: active, direction } = this.sort();
    if (active !== key) {
      return '↕';
    }
    return direction === 'asc' ? '↑' : '↓';
  }
}
