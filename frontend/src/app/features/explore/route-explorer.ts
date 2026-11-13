import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { CityApi } from '../../core/api/city-api';
import { Session } from '../../core/auth/session';
import { TripApi } from '../../core/api/trip-api';
import { ComparisonApi } from '../../core/api/comparison-api';
import { City, Comparison, ComparisonRequest, TripPriority } from '../../core/api/models';
import { MapTrip, RouteMap, RouteSelection } from '../../shared/map/route-map';
import { BottomSheet, SheetState } from '../../shared/ui/bottom-sheet';
import { CityPicker } from '../../shared/ui/city-picker';
import { GlassPanel } from '../../shared/ui/glass-panel';
import { PriorityPicker } from '../../shared/ui/priority-picker';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import {
  addDaysIso,
  daysBetween,
  hasForecast,
  nextWeekIso,
  todayIso,
  weekendIso,
} from '../../shared/util/date';
import { LayoutBreakpoint } from '../../shared/util/layout-breakpoint';
import { MODE_LABELS, PRIORITIES, travelersLabel } from '../../shared/util/labels';
import { ComparisonChart } from '../trips/comparison/comparison-chart';
import { ComparisonPanel } from '../trips/comparison/comparison-panel';
import { LegComparison, legComparison } from '../trips/comparison/leg-comparison';
import { HomeLayout } from './home-layout';
import { MyTripsLayer } from './my-trips-layer';
import { WeatherCard } from './weather-card';

const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 9;
const DEFAULT_PRIORITY: TripPriority = 'BALANCED';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** How many upcoming trips the globe's "My trips" layer shows. */
const UPCOMING_TRIPS = 20;
/** Width of a floating panel in the Map layout, its distance from the map edge and the air beside it (rem). */
const DOCK_WIDTH = 24;
const DOCK_COLLAPSED_WIDTH = 14;
const DOCK_OFFSET = 1.5;
const DOCK_AIR = 1;
const REM_PX = 16;

interface ExplorerState {
  originId: number | null;
  destinationId: number | null;
  date: string;
  travelers: number;
  priority: TripPriority;
}

/**
 * Explore a route without saving anything: choose two cities on the map or in
 * the pickers and the comparison appears; priority, travelers and date re-run
 * it. The selection lives in the URL, so it can be shared and Back restores the
 * previous route. "Save as trip" carries it to the trip form.
 *
 * One template, three arrangements, and the settings and results are rendered once (so ids
 * never repeat and switching never recreates them or refetches). From 1440 px the user can choose
 * (with the toggle in the header) between Map (the map fills the stage, two glass panels float over it) and Split (the map on
 * the left, settings and results on the right; stacked below 1024 px); below 768 px the
 * settings and results live in a bottom sheet under the map. Map and Split only differ in CSS
 * placement, so cities, priority, date, travelers, results and the map view survive a switch.
 */
@Component({
  selector: 'app-route-explorer',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    BottomSheet,
    GlassPanel,
    WeatherCard,
    RouteMap,
    CityPicker,
    PriorityPicker,
    ComparisonChart,
    ComparisonPanel,
    ErrorMessage,
    Spinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-explorer.html',
  styleUrls: ['./route-explorer.scss', './route-explorer-results.scss', './explorer-stage.scss'],
})
export class RouteExplorer {
  private readonly cityApi = inject(CityApi);
  private readonly comparisonApi = inject(ComparisonApi);
  private readonly tripApi = inject(TripApi);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly homeLayout = inject(HomeLayout);
  private readonly breakpoint = inject(LayoutBreakpoint);

  /** Phones: the settings and results go into a bottom sheet. */
  protected readonly sheet = computed(() => this.breakpoint.layout() === 'narrow');
  /** The arrangement on screen; Map only exists from 1440 px and never on a phone. */
  protected readonly arrangement = computed(() =>
    this.sheet() ? 'sheet' : this.homeLayout.effective(),
  );
  /** Panels that float over the map scroll on their own; in Split the column beside the map does. */
  protected readonly dockScroll = computed(() => this.arrangement() === 'map');
  protected readonly sideScroll = computed(
    () => this.arrangement() === 'split' && this.homeLayout.sideBySide(),
  );
  protected readonly formCollapsed = signal(false);
  protected readonly resultsCollapsed = signal(false);
  protected readonly sheetState = signal<SheetState>('peek');

  /** Pixels a floating panel covers at its side of the map (its width, offset and some air). */
  protected readonly insetStart = computed(() => this.dockInset(this.formCollapsed()));
  protected readonly insetEnd = computed(() => this.dockInset(this.resultsCollapsed()));
  /**
   * Inside a scrolling page (stacked Split) the wheel must scroll it; where the map fills the
   * screen or sits beside a column that scrolls on its own, it zooms.
   */
  protected readonly mapGestures = computed(() =>
    this.arrangement() === 'split' && !this.homeLayout.sideBySide() ? 'cooperative' : 'greedy',
  );
  /** No comparison yet: in the Map layout the results panel is only a small hint. */
  protected readonly resultsIdle = computed(() => this.request() === undefined);

  protected readonly travelersLabel = travelersLabel;
  protected readonly today = todayIso();
  protected readonly minTravelers = MIN_TRAVELERS;
  protected readonly maxTravelers = MAX_TRAVELERS;
  /** A week ahead by default: inside the weather forecast window. */
  private readonly defaultDate = addDaysIso(this.today, 7);
  protected readonly quickDates = [
    { label: 'Tomorrow', date: addDaysIso(this.today, 1) },
    { label: 'This weekend', date: weekendIso(this.today) },
    { label: 'Next week', date: nextWeekIso(this.today) },
  ];

  protected readonly cities = rxResource({ stream: () => this.cityApi.findAll() });

  /**
   * The next 20 upcoming trips for the "My trips" layer, only for a logged-in user. The layer is a
   * decoration: while loading, after a failure or without trips the globe simply shows none.
   */
  protected readonly upcomingTrips = rxResource({
    params: () => (this.session.loggedIn() ? this.today : undefined),
    stream: ({ params: from }) =>
      this.tripApi.search({ from, sort: 'date', direction: 'asc', size: UPCOMING_TRIPS }),
  });
  protected readonly myTrips = computed<MapTrip[]>(() =>
    this.upcomingTrips.hasValue()
      ? this.upcomingTrips.value().items.map((trip) => ({
          id: trip.id,
          title: trip.title,
          date: trip.departureDate,
          stops: trip.stops.map((stop) => stop.cityId),
        }))
      : [],
  );
  protected readonly tripsLayer = inject(MyTripsLayer);

  protected readonly originId = signal<number | null>(null);
  protected readonly destinationId = signal<number | null>(null);
  protected readonly priority = signal<TripPriority>(DEFAULT_PRIORITY);
  protected readonly travelers = signal(MIN_TRAVELERS);
  /** '' while no date is chosen (the date was cleared): nothing is compared then. */
  protected readonly date = signal(this.defaultDate);
  /**
   * The quick date the user clicked, as explicit state: only one is active, even when another one
   * names the same day, and it ends when the date is typed, picked or cleared.
   */
  protected readonly activeQuick = signal<string | null>(null);

  protected readonly forecastAvailable = computed(() => hasForecast(this.today, this.date()));
  protected readonly daysAhead = computed(() => daysBetween(this.today, this.date()));

  /** Defined once both cities and a valid date are chosen; drives the comparison. */
  protected readonly request = computed<ComparisonRequest | undefined>(() => {
    const originCityId = this.originId();
    const destinationCityId = this.destinationId();
    const departureDate = this.date();
    if (originCityId === null || destinationCityId === null || departureDate < this.today) {
      return undefined;
    }
    return {
      stops: [{ cityId: originCityId }, { cityId: destinationCityId }],
      departureDate,
      travelers: this.travelers(),
      priority: this.priority(),
    };
  });

  protected readonly comparison = rxResource({
    params: () => this.request(),
    stream: ({ params }) => this.comparisonApi.preview(params),
  });

  /**
   * The comparison on screen. It stays while a new one loads (dimmed), so
   * changing a setting does not make the results jump away.
   */
  protected readonly shown = signal<Comparison | undefined>(undefined);
  protected readonly refreshing = computed(
    () => this.comparison.isLoading() && this.shown() !== undefined,
  );
  /** The explorer compares two stops, so its result is a single leg. */
  protected readonly shownLeg = computed<LegComparison | undefined>(() => {
    const shown = this.shown();
    return shown ? legComparison(shown, 0) : undefined;
  });

  /** One line for the collapsed bottom sheet: the route and the recommended mode, or what to do next. */
  protected readonly summary = computed(() => {
    const leg = this.shownLeg();
    if (leg) {
      const recommended = leg.options.find((option) => option.recommended);
      const route = `${leg.from.name} to ${leg.to.name}`;
      return recommended ? `${route} · ${MODE_LABELS[recommended.mode]} recommended` : route;
    }
    const name = (id: number | null) => this.cities.value()?.find((city) => city.id === id)?.name;
    const origin = name(this.originId());
    const destination = name(this.destinationId());
    if (origin && destination) {
      return `${origin} to ${destination} · comparing…`;
    }
    return origin ? `From ${origin}: choose a destination` : 'Where are you going?';
  });

  /** Query parameters that prefill the trip form with the current selection. */
  protected readonly saveParams = computed(() => {
    const request = this.request();
    return request
      ? {
          from: request.stops[0].cityId,
          to: request.stops[1].cityId,
          date: request.departureDate,
          travelers: request.travelers,
          priority: request.priority,
        }
      : null;
  });

  private readonly queryParams = toSignal(this.route.queryParamMap);

  constructor() {
    effect(() => {
      if (this.request() === undefined) {
        this.shown.set(undefined);
      } else if (this.comparison.hasValue()) {
        // value() throws while the resource is in an error state, so check first.
        this.shown.set(this.comparison.value());
      }
    });

    // URL → state: on first load, on shared links and on Back / Forward.
    effect(() => {
      const params = this.queryParams();
      const cities = this.cities.value();
      if (!params || !cities) {
        return;
      }
      untracked(() => this.applyState(this.urlState(params, cities)));
    });

    // State → URL: a new route adds a history entry; other changes replace it.
    effect(() => {
      const state = this.currentState();
      const params = this.queryParams();
      const cities = this.cities.value();
      if (!params || !cities) {
        return;
      }
      untracked(() => {
        const fromUrl = this.urlState(params, cities);
        if (sameState(state, fromUrl)) {
          return;
        }
        const newRoute =
          state.originId !== fromUrl.originId || state.destinationId !== fromUrl.destinationId;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: this.toQueryParams(state),
          replaceUrl: !newRoute,
        });
      });
    });
  }

  private dockInset(collapsed: boolean): number {
    if (this.arrangement() !== 'map') {
      return 0;
    }
    return ((collapsed ? DOCK_COLLAPSED_WIDTH : DOCK_WIDTH) + DOCK_OFFSET + DOCK_AIR) * REM_PX;
  }

  protected select(selection: RouteSelection): void {
    this.originId.set(selection.originId);
    this.destinationId.set(selection.destinationId);
  }

  protected openTrip(id: number): void {
    void this.router.navigate(['/trips', id]);
  }

  protected setOrigin(id: number | null): void {
    this.originId.set(id);
  }

  protected setDestination(id: number | null): void {
    this.destinationId.set(id);
  }

  protected swap(): void {
    const origin = this.originId();
    this.originId.set(this.destinationId());
    this.destinationId.set(origin);
  }

  protected changeTravelers(delta: number): void {
    this.travelers.update((value) =>
      Math.min(MAX_TRAVELERS, Math.max(MIN_TRAVELERS, value + delta)),
    );
  }

  /** The date field changed: a date, or empty when it was cleared. Ends the active quick date. */
  protected setDate(value: string): void {
    if (value === '' || ISO_DATE.test(value)) {
      this.date.set(value);
      this.activeQuick.set(null);
    }
  }

  /** Selects a quick date; the active one again deselects it and clears the date. */
  protected toggleQuick(quick: { label: string; date: string }): void {
    const deselect = this.activeQuick() === quick.label;
    this.activeQuick.set(deselect ? null : quick.label);
    this.date.set(deselect ? '' : quick.date);
  }

  private currentState(): ExplorerState {
    return {
      originId: this.originId(),
      destinationId: this.destinationId(),
      date: this.date(),
      travelers: this.travelers(),
      priority: this.priority(),
    };
  }

  private applyState(state: ExplorerState): void {
    this.originId.set(state.originId);
    this.destinationId.set(state.destinationId);
    if (state.date !== this.date()) {
      this.date.set(state.date);
      this.activeQuick.set(null);
    }
    this.travelers.set(state.travelers);
    this.priority.set(state.priority);
  }

  /** The URL's state, except that a cleared date stays cleared while the URL has no date (it is never written). */
  private urlState(params: ParamMap, cities: City[]): ExplorerState {
    const state = this.parseState(params, cities);
    return !params.has('date') && this.date() === '' ? { ...state, date: '' } : state;
  }

  /** Reads the URL; anything unknown or out of range falls back to the default. */
  private parseState(params: ParamMap, cities: City[]): ExplorerState {
    const cityId = (key: string) => {
      const id = Number(params.get(key));
      return cities.some((city) => city.id === id) ? id : null;
    };
    const originId = cityId('from');
    const destination = cityId('to');
    const date = params.get('date') ?? '';
    const travelers = Number(params.get('travelers'));
    const priority = PRIORITIES.find((option) => option === params.get('priority'));
    return {
      originId,
      destinationId: destination === originId ? null : destination,
      date: ISO_DATE.test(date) && date >= this.today ? date : this.defaultDate,
      travelers:
        Number.isInteger(travelers) && travelers >= MIN_TRAVELERS && travelers <= MAX_TRAVELERS
          ? travelers
          : MIN_TRAVELERS,
      priority: priority ?? DEFAULT_PRIORITY,
    };
  }

  /** Only values that differ from the defaults go into the URL, to keep links short. */
  private toQueryParams(state: ExplorerState): Record<string, string | number> {
    const params: Record<string, string | number> = {};
    if (state.originId !== null) params['from'] = state.originId;
    if (state.destinationId !== null) params['to'] = state.destinationId;
    if (state.date !== '' && state.date !== this.defaultDate) params['date'] = state.date;
    if (state.travelers !== MIN_TRAVELERS) params['travelers'] = state.travelers;
    if (state.priority !== DEFAULT_PRIORITY) params['priority'] = state.priority;
    return params;
  }
}

function sameState(a: ExplorerState, b: ExplorerState): boolean {
  return (
    a.originId === b.originId &&
    a.destinationId === b.destinationId &&
    a.date === b.date &&
    a.travelers === b.travelers &&
    a.priority === b.priority
  );
}
