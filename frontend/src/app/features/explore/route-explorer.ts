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
import { ComparisonApi } from '../../core/api/comparison-api';
import { City, Comparison, ComparisonRequest, TripPriority } from '../../core/api/models';
import { RouteMap, RouteSelection } from '../../shared/map/route-map';
import { CityPicker } from '../../shared/ui/city-picker';
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
import { PRIORITIES, travelersLabel } from '../../shared/util/labels';
import { ComparisonChart } from '../trips/comparison/comparison-chart';
import { ComparisonPanel } from '../trips/comparison/comparison-panel';
import { LegComparison, legComparison } from '../trips/comparison/leg-comparison';

const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 9;
const DEFAULT_PRIORITY: TripPriority = 'BALANCED';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
 */
@Component({
  selector: 'app-route-explorer',
  imports: [
    RouterLink,
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
  styleUrl: './route-explorer.scss',
})
export class RouteExplorer {
  private readonly cityApi = inject(CityApi);
  private readonly comparisonApi = inject(ComparisonApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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

  protected readonly originId = signal<number | null>(null);
  protected readonly destinationId = signal<number | null>(null);
  protected readonly priority = signal<TripPriority>(DEFAULT_PRIORITY);
  protected readonly travelers = signal(MIN_TRAVELERS);
  protected readonly date = signal(this.defaultDate);

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
      untracked(() => this.applyState(this.parseState(params, cities)));
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
        const fromUrl = this.parseState(params, cities);
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

  protected select(selection: RouteSelection): void {
    this.originId.set(selection.originId);
    this.destinationId.set(selection.destinationId);
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

  protected setDate(value: string): void {
    if (ISO_DATE.test(value)) {
      this.date.set(value);
    }
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
    this.date.set(state.date);
    this.travelers.set(state.travelers);
    this.priority.set(state.priority);
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
    if (state.date !== this.defaultDate) params['date'] = state.date;
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
