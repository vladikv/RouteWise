import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip, TripPriority } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { TripEntry, modeSummary } from './trip-figures';
import { DEFAULT_SORT, SortKey, TripSort, toggleSort } from './trip-filters';
import { TripActions } from './trip-actions';
import { TripPrioritySelect } from './trip-priority-select';
import { RowDetail, TripRowDetails } from './trip-row-details';
import { TripMenu } from './trip-menu';
import { TripMove } from './trip-move';

/** Controls inside a row; all but the active row's (the toggle itself is bound) are taken out of the Tab order. */
const FOCUSABLE = 'a[href], button, select';

/**
 * Trips as a table, one row each, in the order the API sorted them; the header buttons (date,
 * cost, CO₂) change the page's sort and `aria-sort` marks the active one. A click on a row, or
 * its disclosure button (`aria-expanded`), expands it inline into `TripRowDetails` (one row at a
 * time; the page loads the comparison and passes it in `details`). The title link still opens the
 * trip. On narrow screens the date, route, mode, priority and CO₂ columns fold into a second line
 * under the title.
 *
 * Keyboard: the body is a single tab stop. The disclosure button of the active row
 * (`tabindex="0"`, the others `-1`, and the controls inside the other rows too) takes focus;
 * ArrowUp/ArrowDown, Home and End move between the rows' buttons, Enter or Space toggles
 * (native button, `aria-expanded`), Escape collapses the row and keeps focus on its button. Tab
 * goes through the active row's own controls, then leaves the table.
 */
@Component({
  selector: 'app-trip-table',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    ModeIcon,
    TripActions,
    TripMenu,
    TripPrioritySelect,
    TripRowDetails,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(focusin)': 'onFocusIn($event)', '(keydown)': 'onKeydown($event)' },
  templateUrl: './trip-table.html',
  styleUrl: './trip-table.scss',
})
export class TripTable {
  readonly entries = input.required<TripEntry[]>();
  readonly movingIds = input<ReadonlySet<number>>(new Set());
  /** Each expanded trip's lazily loaded comparison, by trip id. */
  readonly details = input<ReadonlyMap<number, RowDetail>>(new Map());
  readonly sort = model<TripSort>(DEFAULT_SORT);
  /** The expanded trip, if any; set by a click, Enter, Space or the disclosure button. */
  readonly expandedId = model<number | null>(null);
  readonly deleteRequested = output<Trip>();
  readonly moved = output<TripMove>();
  /** The comparison of this trip failed to load and the user asked again. */
  readonly detailRetry = output<Trip>();

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly modeSummary = modeSummary;

  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly activeId = signal<number | null>(null);
  /** The row that is the table's tab stop: the one last focused, else the first. */
  protected readonly tabStopId = computed(() => {
    const entries = this.entries();
    const id = this.activeId();
    return entries.some(({ trip }) => trip.id === id) ? id : (entries[0]?.trip.id ?? null);
  });

  constructor() {
    afterRenderEffect(() => {
      const stop = String(this.tabStopId());
      this.entries();
      this.expandedId();
      this.details();
      for (const row of this.body().nativeElement.querySelectorAll('tr[data-trip]')) {
        const active = (row as HTMLElement).dataset['trip'] === stop;
        for (const control of row.querySelectorAll(FOCUSABLE)) {
          if (control.classList.contains('toggle')) {
            continue;
          }
          if (active) {
            control.removeAttribute('tabindex');
          } else {
            control.setAttribute('tabindex', '-1');
          }
        }
      }
    });
  }

  protected move(trip: Trip, priority: TripPriority, focus: boolean): void {
    this.moved.emit({ trip, priority, focus });
  }

  protected toggle(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  /** A click on the row itself (not on a link, button or select inside it) expands it. */
  protected onRowClick(event: MouseEvent, id: number): void {
    const interactive = 'a, button, select, app-trip-priority-select, .menu-panel';
    if (!(event.target as Element).closest(interactive)) {
      this.toggle(id);
    }
  }

  protected onFocusIn(event: FocusEvent): void {
    const id = this.rowIdOf(event.target);
    if (id !== null) {
      this.activeId.set(id);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const id = this.rowIdOf(target);
    if (id === null) {
      return;
    }
    if (event.key === 'Escape') {
      this.collapse(id);
      return;
    }
    if (!target.closest('.toggle, .trip__name a')) {
      return;
    }
    const ids = this.entries().map(({ trip }) => trip.id);
    const index = ids.indexOf(id);
    const targets: Record<string, number> = {
      ArrowDown: Math.min(index + 1, ids.length - 1),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: ids.length - 1,
    };
    const next = targets[event.key];
    if (next !== undefined) {
      event.preventDefault();
      this.toggleElement(ids[next])?.focus();
    }
  }

  /** Escape collapses the expanded row and keeps focus on its toggle, unless one of its menus is open (that closes first). */
  private collapse(id: number): void {
    const toggle = this.toggleElement(id);
    if (this.expandedId() === id && !toggle?.closest('tr')?.querySelector('.menu-panel')) {
      this.expandedId.set(null);
      toggle?.focus();
    }
  }

  private rowIdOf(target: EventTarget | null): number | null {
    const id = (target as Element | null)?.closest('tr[data-trip]')?.getAttribute('data-trip');
    return id == null ? null : Number(id);
  }

  private toggleElement(id: number): HTMLElement | null {
    return this.body().nativeElement.querySelector<HTMLElement>(
      `tr.row[data-trip="${id}"] .toggle`,
    );
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

  /** Sort marker; U+FE0E forces text presentation (Windows draws a bare arrow as a colour emoji). */
  protected arrow(key: SortKey): string {
    const { key: active, direction } = this.sort();
    if (active !== key) {
      return '↕︎';
    }
    return direction === 'asc' ? '↑︎' : '↓︎';
  }
}
