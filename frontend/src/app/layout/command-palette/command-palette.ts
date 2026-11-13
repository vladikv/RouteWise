import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Params, Router } from '@angular/router';
import { forkJoin, map, of, switchMap, timer } from 'rxjs';
import { CityApi } from '../../core/api/city-api';
import { City, Trip } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { Session } from '../../core/auth/session';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Modal } from '../../shared/ui/modal';
import { homeFieldFor, homeQueryFor } from './home-target';

/** Results per group. */
export const PALETTE_LIMIT = 5;
/** Typing pause before the search goes to the API. */
export const PALETTE_DEBOUNCE_MS = 200;

interface ResultSet {
  cities: City[];
  trips: Trip[];
}

type PaletteOption =
  { kind: 'city'; id: string; city: City } | { kind: 'trip'; id: string; trip: Trip };

/**
 * Search palette (rail Search, Ctrl/Cmd + K): one combobox over cities and, when logged in, the
 * user's trips, from the existing search endpoints. Enter or a click on a city sets it as Home's
 * From (or To, when From is set); on a trip it opens the trip. Escape closes it and returns focus.
 */
@Component({
  selector: 'app-command-palette',
  imports: [DatePipe, Modal, ErrorMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.scss',
})
export class CommandPalette {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly cityApi = inject(CityApi);
  private readonly tripApi = inject(TripApi);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly loggedIn = inject(Session).loggedIn;

  /** Empty again each time the palette opens. */
  protected readonly query = linkedSignal({ source: this.open, computation: () => '' });
  private readonly trimmed = computed(() => this.query().trim());

  protected readonly results = rxResource({
    params: () =>
      this.open() && this.trimmed() ? { q: this.trimmed(), trips: this.loggedIn() } : undefined,
    stream: ({ params }) =>
      timer(PALETTE_DEBOUNCE_MS).pipe(
        switchMap(() =>
          forkJoin({
            cities: this.cityApi.findAll(params.q),
            trips: params.trips
              ? this.tripApi
                  .search({ q: params.q, size: PALETTE_LIMIT })
                  .pipe(map((page) => page.items))
              : of([] as Trip[]),
          }),
        ),
      ),
  });
  /** The results belong to the current text (not a previous one still on screen). */
  private readonly ready = computed(
    () => this.trimmed() !== '' && this.results.hasValue() && !this.results.isLoading(),
  );

  /**
   * The results on screen: the latest that arrived, kept while a new search loads (so the list does
   * not blink on every keystroke); nothing once the text is empty or the palette was closed.
   */
  private readonly shown = linkedSignal<
    { open: boolean; empty: boolean; fresh: ResultSet | null },
    ResultSet | null
  >({
    source: () => ({
      open: this.open(),
      empty: this.trimmed() === '',
      fresh: this.ready() ? (this.results.value() ?? null) : null,
    }),
    computation: (source, previous) =>
      source.open && !source.empty ? (source.fresh ?? previous?.value ?? null) : null,
  });
  protected readonly loading = computed(
    () => this.trimmed() !== '' && !this.ready() && !this.results.error(),
  );

  protected readonly cityOptions = computed<PaletteOption[]>(() =>
    (this.shown()?.cities ?? [])
      .slice(0, PALETTE_LIMIT)
      .map((city) => ({ kind: 'city', id: `palette-city-${city.id}`, city })),
  );
  protected readonly tripOptions = computed<PaletteOption[]>(() =>
    (this.shown()?.trips ?? []).map((trip) => ({
      kind: 'trip',
      id: `palette-trip-${trip.id}`,
      trip,
    })),
  );
  protected readonly options = computed(() => [...this.cityOptions(), ...this.tripOptions()]);
  /** The highlighted option; it stays on the same option when the results change, else the first. */
  private readonly activeIndex = linkedSignal<PaletteOption[], number>({
    source: this.options,
    computation: (options, previous) => {
      const id = previous?.source[previous.value]?.id;
      const index = options.findIndex((option) => option.id === id);
      return index >= 0 ? index : 0;
    },
  });
  protected readonly activeOption = computed(() => this.options()[this.activeIndex()] ?? null);

  /** The Home field a city fills, read from the URL each time the palette opens. */
  protected readonly target = computed(() => {
    this.open();
    return homeFieldFor(this.homeParams());
  });

  protected readonly status = computed(() => {
    if (!this.trimmed()) {
      return this.loggedIn()
        ? 'Type a city or a trip title.'
        : 'Type a city. Log in to search your trips too.';
    }
    if (!this.ready()) {
      return this.results.error() ? '' : 'Searching…';
    }
    const cities = this.cityOptions().length;
    const trips = this.tripOptions().length;
    if (cities + trips === 0) {
      return `Nothing found for “${this.trimmed()}”.`;
    }
    const parts = [plural(cities, 'city', 'cities')];
    if (this.loggedIn()) {
      parts.push(plural(trips, 'trip', 'trips'));
    }
    return parts.join(', ') + '.';
  });

  /** Enter pressed before the results of the current text arrived; reset by new input and on close. */
  private readonly pendingEnter = linkedSignal<{ open: boolean; query: string }, boolean>({
    source: () => ({ open: this.open(), query: this.query() }),
    computation: () => false,
  });

  constructor() {
    effect(() => {
      const option = this.activeOption();
      if (this.pendingEnter() && this.ready() && option) {
        untracked(() => this.choose(option));
      }
    });
    // Focus stays in the input, so the browser does not scroll the highlighted option into view.
    afterRenderEffect(() => {
      const id = this.activeOption()?.id;
      if (id) {
        this.host.nativeElement.querySelector(`#${id}`)?.scrollIntoView?.({ block: 'nearest' });
      }
    });
  }

  /** The pointer and the arrow keys move the same highlight. */
  protected highlight(option: PaletteOption): void {
    this.activeIndex.set(this.options().indexOf(option));
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.options().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (count > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.set((this.activeIndex() + step + count) % count);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.activeOption();
      if (option && this.ready()) {
        this.choose(option);
      } else if (this.trimmed()) {
        // Enter waits for the results of the text that is typed now, then chooses.
        this.pendingEnter.set(true);
      }
    }
  }

  protected choose(option: PaletteOption): void {
    if (option.kind === 'city') {
      void this.router.navigate(['/'], {
        queryParams: homeQueryFor(option.city.id, this.homeParams()),
      });
    } else {
      void this.router.navigate(['/trips', option.trip.id]);
    }
    this.closed.emit();
  }

  /** Home's query parameters while Home is open, otherwise null. */
  private homeParams(): Params | null {
    const tree = this.router.parseUrl(this.router.url);
    const onHome = (tree.root.children['primary']?.segments.length ?? 0) === 0;
    return onHome ? tree.queryParams : null;
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
