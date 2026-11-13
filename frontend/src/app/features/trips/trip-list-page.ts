import { DecimalPipe, CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import {
  TransportModeCode,
  Trip,
  TripListItem,
  TripPage,
  TripPriority,
} from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { ToastService } from '../../shared/ui/toast';
import { Spinner } from '../../shared/ui/spinner';
import { StatChip } from '../../shared/ui/stat-chip';
import { LayoutBreakpoint } from '../../shared/util/layout-breakpoint';
import { TripBoard } from './list/trip-board';
import { boardColumns, tripEntries } from './list/trip-figures';
import {
  DEFAULT_SORT,
  TripSort,
  hasActiveFilters,
  modeCounts,
  priorityCounts,
  tripSearch,
} from './list/trip-filters';
import { TripTable } from './list/trip-table';
import {
  TripMove,
  moveFailedMessage,
  moveRequest,
  movedMessage,
  replaceTrip,
  withPriority,
} from './list/trip-move';
import { TripToolbar, TripView } from './list/trip-toolbar';

/** Typing pauses this long before the search goes to the API. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * All saved trips with KPIs, filters and a board or list view. The API searches, filters,
 * sorts and computes every figure (`GET /api/trips`, `GET /api/trips/stats`); the page only
 * keeps the query and shows the answer. While a new answer loads, the previous one stays.
 */
@Component({
  selector: 'app-trip-list-page',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    ErrorMessage,
    Spinner,
    StatChip,
    TripBoard,
    TripTable,
    TripToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-list-page.html',
  styleUrl: './trip-list-page.scss',
})
export class TripListPage {
  private readonly tripApi = inject(TripApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutBreakpoint).layout;
  private readonly toasts = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly search = signal('');
  protected readonly priorities = signal<TripPriority[]>([]);
  protected readonly modes = signal<TransportModeCode[]>([]);
  protected readonly sort = signal<TripSort>(DEFAULT_SORT);
  private readonly chosenView = signal<TripView | null>(null);
  /** The user's choice, else the board on wide screens and the list elsewhere. */
  protected readonly view = computed<TripView>(
    () => this.chosenView() ?? (this.layout() === 'wide' ? 'board' : 'list'),
  );

  /** The search text the API sees: typing is debounced, clearing applies at once. */
  private readonly appliedSearch = signal('');
  /**
   * The board keeps date order; the table's sort only applies to the list. Compared by value,
   * so a change that leaves the query the same (e.g. switching views) sends no request.
   */
  private readonly query = computed(
    () =>
      tripSearch(
        { search: this.appliedSearch(), priorities: this.priorities(), modes: this.modes() },
        this.view() === 'list' ? this.sort() : DEFAULT_SORT,
      ),
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  protected readonly trips = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.tripApi.search(params),
  });
  protected readonly stats = rxResource({ stream: () => this.tripApi.stats() });

  /** The latest page; kept while the next one loads, and changed in place by moves and deletes. */
  protected readonly page = linkedSignal<TripPage | undefined, TripPage | undefined>({
    source: () => (this.trips.hasValue() ? this.trips.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteError = signal<unknown>(null);
  /** Trips whose priority change is waiting for the API. */
  protected readonly movingIds = signal<ReadonlySet<number>>(new Set());
  /** Spoken by a polite live region after a move or a restore. */
  protected readonly announcement = signal('');

  protected readonly filtering = computed(() =>
    hasActiveFilters({
      search: this.search(),
      priorities: this.priorities(),
      modes: this.modes(),
    }),
  );
  protected readonly entries = computed(() => {
    const page = this.page();
    return page ? tripEntries(page) : [];
  });
  protected readonly priorityCounts = computed(() => {
    const page = this.page();
    return page ? priorityCounts(page) : null;
  });
  protected readonly modeCounts = computed(() => {
    const page = this.page();
    return page ? modeCounts(page) : null;
  });
  /** All of the user's trips (from the stats), else the matching ones. */
  protected readonly total = computed(
    () =>
      (this.stats.hasValue() ? this.stats.value().tripsPlanned : null) ??
      this.page()?.totalItems ??
      0,
  );
  protected readonly columns = computed(() => {
    const page = this.page();
    return page ? boardColumns(this.entries(), page, this.priorities()) : [];
  });

  protected setView(view: TripView): void {
    this.chosenView.set(view);
  }

  constructor() {
    toObservable(this.search)
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((text) => this.appliedSearch.set(text));
  }

  protected clearFilters(): void {
    this.search.set('');
    this.appliedSearch.set('');
    this.priorities.set([]);
    this.modes.set([]);
  }

  /** Deletes at once and offers Undo in a toast while the API can still restore the trip. */
  protected delete(trip: Trip): void {
    this.deletingId.set(trip.id);
    this.deleteError.set(null);
    this.tripApi.delete(trip.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.updateItems((items) => items.filter((item) => item.id !== trip.id));
        this.refresh();
        this.toasts.show({
          kind: 'info',
          message: `Deleted "${trip.title}"`,
          action: { label: 'Undo', run: () => this.restore(trip) },
        });
      },
      error: (error: unknown) => {
        this.deletingId.set(null);
        this.deleteError.set(error);
      },
    });
  }

  /**
   * Gives a trip another priority. The page shows it in the new column at once; the API call
   * (a PUT with all of the trip's fields) is followed by a fresh list and stats, because the
   * priority weights the recommendation. On failure the trip goes back and a toast offers a retry.
   */
  protected move({ trip, priority, focus }: TripMove): void {
    const current = this.page()?.items.find((item) => item.id === trip.id);
    if (!current || current.priority === priority || this.movingIds().has(current.id)) {
      return;
    }
    const previous = current.priority;
    this.setMoving(current.id, true);
    this.updateItems((items) => withPriority(items, current.id, priority));
    this.announcement.set(movedMessage(current, priority));
    if (focus) {
      this.focusTitle(current.id);
    }
    this.tripApi
      .update(current.id, moveRequest(current, priority))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.setMoving(current.id, false);
          this.updateItems((items) => replaceTrip(items, saved));
          this.refresh();
        },
        error: (error: unknown) => {
          this.setMoving(current.id, false);
          this.updateItems((items) => withPriority(items, current.id, previous));
          this.announcement.set('');
          if (focus) {
            this.focusTitle(current.id);
          }
          const reason = error instanceof ApiError ? error.message : 'Please try again.';
          this.toasts.show({
            kind: 'error',
            message: moveFailedMessage(current, priority, reason),
            action: { label: 'Retry', run: () => this.move({ trip: current, priority, focus }) },
          });
        },
      });
  }

  private restore(trip: Trip): void {
    this.tripApi
      .restore(trip.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.announcement.set(`Restored "${trip.title}"`);
          this.refresh();
        },
        error: (error: unknown) => {
          const reason = error instanceof ApiError ? error.message : 'Please try again.';
          this.toasts.show({
            kind: 'error',
            message: `Couldn't restore "${trip.title}". ${reason}`,
          });
        },
      });
  }

  /** New list and stats from the API; the current page stays visible meanwhile. */
  private refresh(): void {
    this.trips.reload();
    this.stats.reload();
  }

  private updateItems(change: (items: TripListItem[]) => TripListItem[]): void {
    this.page.update((page) => page && { ...page, items: change(page.items) });
  }

  /** After the list re-rendered, puts focus on the trip's title link (card or row) in its new place. */
  private focusTitle(id: number): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(
            `.trip__title a[href="/trips/${id}"], .trip__name a[href="/trips/${id}"]`,
          )
          ?.focus(),
      { injector: this.injector },
    );
  }

  private setMoving(id: number, moving: boolean): void {
    this.movingIds.update((ids) => {
      const next = new Set(ids);
      if (moving) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
