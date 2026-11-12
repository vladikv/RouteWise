import { DecimalPipe, CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';
import { TransportModeCode, Trip, TripPriority } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ErrorMessage } from '../../shared/ui/error-message';
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
import { modeCounts, priorityCounts } from './list/trip-filters';
import { TripTable } from './list/trip-table';
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

  protected readonly trips = rxResource({
    stream: () => this.tripApi.findAll().pipe(tap((list) => this.loadFigures(list))),
  });
  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteError = signal<unknown>(null);

  protected readonly search = signal('');
  protected readonly priorities = signal<TripPriority[]>([]);
  protected readonly modes = signal<TransportModeCode[]>([]);
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

  /** One comparison request per trip, all in parallel. */
  private loadFigures(trips: Trip[]): void {
    this.figures.set(Object.fromEntries(trips.map((trip) => [trip.id, LOADING])));
    for (const trip of trips) {
      this.tripApi
        .compare(trip.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (comparison) =>
            this.setFigures(trip.id, { status: 'ready', figures: tripFigures(comparison) }),
          error: () => this.setFigures(trip.id, { status: 'failed' }),
        });
    }
  }

  private setFigures(id: number, state: FigureState): void {
    this.figures.update((current) => ({ ...current, [id]: state }));
  }
}
