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
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { TransportModeCode, Trip, TripPriority } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { ToastService } from '../../shared/ui/toast';
import { Spinner } from '../../shared/ui/spinner';
import { StatChip } from '../../shared/ui/stat-chip';
import { LayoutBreakpoint } from '../../shared/util/layout-breakpoint';
import { TripBoard } from './list/trip-board';
import {
  FigureState,
  TripEntry,
  filterTrips,
  groupByPriority,
  tripFigures,
  tripKpis,
} from './list/trip-figures';
import { DEFAULT_SORT, TripSort, modeCounts, priorityCounts } from './list/trip-filters';
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

const LOADING: FigureState = { status: 'loading' };

/**
 * All saved trips with KPIs, filters and a board or list view. Each trip's figures
 * come from its own comparison request, started once the list has arrived.
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

  protected readonly trips = rxResource({
    stream: () => this.tripApi.findAll().pipe(tap((list) => this.loadFigures(list))),
  });
  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteError = signal<unknown>(null);
  /** Trips whose priority change is waiting for the API. */
  protected readonly movingIds = signal<ReadonlySet<number>>(new Set());
  /** Spoken by a polite live region after a move. */
  protected readonly announcement = signal('');

  protected readonly search = signal('');
  protected readonly priorities = signal<TripPriority[]>([]);
  protected readonly modes = signal<TransportModeCode[]>([]);
  protected readonly sort = signal<TripSort>(DEFAULT_SORT);
  private readonly chosenView = signal<TripView | null>(null);
  /** The user's choice, else the board on wide screens and the list elsewhere. */
  protected readonly view = computed<TripView>(
    () => this.chosenView() ?? (this.layout() === 'wide' ? 'board' : 'list'),
  );

  private readonly figures = signal<Record<number, FigureState>>({});
  private readonly entries = computed<TripEntry[]>(() =>
    (this.trips.hasValue() ? this.trips.value() : []).map((trip) => ({
      trip,
      state: this.figures()[trip.id] ?? LOADING,
    })),
  );
  protected readonly kpis = computed(() => tripKpis(this.entries()));
  protected readonly figuresLoading = computed(() =>
    this.entries().some((entry) => entry.state.status === 'loading'),
  );
  protected readonly priorityCounts = computed(() => priorityCounts(this.entries()));
  protected readonly modeCounts = computed(() => modeCounts(this.entries()));
  protected readonly total = computed(() => this.entries().length);
  protected readonly visible = computed(() =>
    filterTrips(this.entries(), {
      search: this.search(),
      priorities: this.priorities(),
      modes: this.modes(),
    }),
  );
  protected readonly columns = computed(() => {
    const selected = this.priorities();
    return groupByPriority(this.visible()).filter(
      (column) => selected.length === 0 || selected.includes(column.priority),
    );
  });

  protected setView(view: TripView): void {
    this.chosenView.set(view);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.priorities.set([]);
    this.modes.set([]);
  }

  protected delete(trip: Trip): void {
    this.deletingId.set(trip.id);
    this.deleteError.set(null);
    this.tripApi.delete(trip.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.trips.update((list) => list?.filter((item) => item.id !== trip.id));
      },
      error: (error: unknown) => {
        this.deletingId.set(null);
        this.deleteError.set(error);
      },
    });
  }

  /**
   * Gives a trip another priority. The page shows it in the new column at once; the API call
   * (a PUT with all of the trip's fields) then replaces it with the saved trip, or the trip goes
   * back to where it was and an error toast offers a retry.
   */
  protected move({ trip, priority, focus }: TripMove): void {
    const current = this.trips.hasValue()
      ? this.trips.value().find((item) => item.id === trip.id)
      : undefined;
    if (!current || current.priority === priority || this.movingIds().has(current.id)) {
      return;
    }
    const previous = current.priority;
    this.setMoving(current.id, true);
    this.trips.update((list) => list && withPriority(list, current.id, priority));
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
          this.trips.update((list) => list && replaceTrip(list, saved));
          this.requestFigures(saved.id, false);
        },
        error: (error: unknown) => {
          this.setMoving(current.id, false);
          this.trips.update((list) => list && withPriority(list, current.id, previous));
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

  /** One comparison request per trip, all in parallel. */
  private loadFigures(trips: Trip[]): void {
    this.figures.set(Object.fromEntries(trips.map((trip) => [trip.id, LOADING])));
    for (const trip of trips) {
      this.requestFigures(trip.id, true);
    }
  }

  /**
   * Fetches one trip's comparison. After a move it runs again, because the priority weights the
   * recommendation; then the old figures stay if it fails (`showFailure` is false).
   */
  private requestFigures(id: number, showFailure: boolean): void {
    this.tripApi
      .compare(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comparison) =>
          this.setFigures(id, { status: 'ready', figures: tripFigures(comparison) }),
        error: () => {
          if (showFailure) {
            this.setFigures(id, { status: 'failed' });
          }
        },
      });
  }

  private setFigures(id: number, state: FigureState): void {
    this.figures.update((current) => ({ ...current, [id]: state }));
  }
}
