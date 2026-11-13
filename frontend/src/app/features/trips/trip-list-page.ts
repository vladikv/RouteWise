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
import { Subscription, debounceTime } from 'rxjs';
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
import { Pagination } from '../../shared/ui/pagination';
import { ToastService } from '../../shared/ui/toast';
import { Spinner } from '../../shared/ui/spinner';
import { StatChip } from '../../shared/ui/stat-chip';
import { LayoutBreakpoint } from '../../shared/util/layout-breakpoint';
import { TripBoard } from './list/trip-board';
import { boardColumns, tripEntries } from './list/trip-figures';
import {
  DEFAULT_SORT,
  LIST_PAGE_SIZE,
  TripSort,
  hasActiveFilters,
  modeCounts,
  priorityCounts,
  tripSearch,
} from './list/trip-filters';
import { RowDetail } from './list/trip-row-details';
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
import { TripDeleteDialog } from './trip-delete-dialog';
import { DeletionHooks, TripDeletion } from './trip-deletion';

/** Typing pauses this long before the search goes to the API. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * All saved trips with KPIs, filters and a board or list view. The API searches, filters,
 * sorts, pages and computes every figure (`GET /api/trips`, `GET /api/trips/stats`); the page
 * only keeps the query and shows the answer. While a new answer loads, the previous one stays.
 * The list view pages by 20 and expands a row into the trip's comparison, loaded on first expand
 * and kept for the page's lifetime; the board loads up to 100 trips at once.
 */
@Component({
  selector: 'app-trip-list-page',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    ErrorMessage,
    Pagination,
    Spinner,
    StatChip,
    TripBoard,
    TripDeleteDialog,
    TripTable,
    TripToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-list-page.html',
  styleUrl: './trip-list-page.scss',
  providers: [TripDeletion],
})
export class TripListPage {
  private readonly tripApi = inject(TripApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layout = inject(LayoutBreakpoint).layout;
  private readonly toasts = inject(ToastService);
  private readonly injector = inject(Injector);
  protected readonly deletion = inject(TripDeletion);
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
  /** The board keeps date order and the table's sort only applies to the list. */
  private readonly effectiveSort = computed(() =>
    this.view() === 'list' ? this.sort() : DEFAULT_SORT,
  );
  /** Zero-based page of the list view; any change of filters, search, sort or view goes back to 0. */
  protected readonly pageIndex = linkedSignal<string, number>({
    source: () =>
      JSON.stringify([
        this.appliedSearch(),
        this.priorities(),
        this.modes(),
        this.effectiveSort(),
        this.view(),
      ]),
    computation: () => 0,
  });
  /** Compared by value, so a change that leaves the query the same sends no request. */
  private readonly query = computed(
    () =>
      tripSearch(
        { search: this.appliedSearch(), priorities: this.priorities(), modes: this.modes() },
        this.effectiveSort(),
        this.view() === 'list' ? { page: this.pageIndex(), size: LIST_PAGE_SIZE } : undefined,
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

  /** The list row that is expanded, and each trip's comparison loaded for it so far. */
  protected readonly expandedId = signal<number | null>(null);
  protected readonly details = signal<ReadonlyMap<number, RowDetail>>(new Map());
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

  protected confirmDelete(): void {
    this.deletion.confirm(this.deletionHooks);
  }

  /** The row opens or closes; a comparison that was never loaded is requested once. */
  protected expand(id: number | null): void {
    this.expandedId.set(id);
    if (id !== null && !this.details().has(id)) {
      this.loadDetail(id);
    }
  }

  protected retryDetail(trip: Trip): void {
    this.loadDetail(trip.id);
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
          this.reloadDetail(current.id);
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

  /** What happens once the API has deleted or restored a trip (see `TripDeletion`). */
  private readonly deletionHooks: DeletionHooks = {
    deleted: (trip) => {
      this.forgetDetail(trip.id);
      this.updateItems((items) => items.filter((item) => item.id !== trip.id));
      this.stats.reload();
      if (this.page()?.items.length === 0 && this.pageIndex() > 0) {
        this.pageIndex.update((index) => index - 1);
      } else {
        this.trips.reload();
      }
    },
    restored: (trip) => {
      this.announcement.set(`Restored "${trip.title}"`);
      this.refresh();
    },
  };

  /** New list and stats from the API; the current page stays visible meanwhile. */
  private refresh(): void {
    this.trips.reload();
    this.stats.reload();
  }

  /** A newer request for a trip replaces the one still running, so an old answer never overwrites it. */
  private readonly detailRequests = new Map<number, Subscription>();

  private loadDetail(id: number): void {
    this.detailRequests.get(id)?.unsubscribe();
    this.setDetail(id, { status: 'loading' });
    const request = this.tripApi
      .compare(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comparison) => this.setDetail(id, { status: 'ready', comparison }),
        error: (error: unknown) => this.setDetail(id, { status: 'error', error }),
      });
    this.detailRequests.set(id, request);
  }

  /** The priority weights the recommendation, so a loaded comparison is stale after a move. */
  private reloadDetail(id: number): void {
    if (!this.details().has(id)) {
      return;
    }
    if (this.expandedId() === id) {
      this.loadDetail(id);
    } else {
      this.forgetDetail(id);
    }
  }

  private forgetDetail(id: number): void {
    this.detailRequests.get(id)?.unsubscribe();
    this.detailRequests.delete(id);
    if (this.expandedId() === id) {
      this.expandedId.set(null);
    }
    this.setDetail(id, null);
  }

  private setDetail(id: number, detail: RowDetail | null): void {
    this.details.update((current) => {
      const next = new Map(current);
      if (detail) {
        next.set(id, detail);
      } else {
        next.delete(id);
      }
      return next;
    });
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
