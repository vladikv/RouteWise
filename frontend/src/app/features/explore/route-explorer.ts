import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CityApi } from '../../core/api/city-api';
import { ComparisonApi } from '../../core/api/comparison-api';
import { ComparisonRequest, TripPriority } from '../../core/api/models';
import { RouteMap, RouteSelection } from '../../shared/map/route-map';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { addDaysIso, todayIso } from '../../shared/util/date';
import { PRIORITIES, PRIORITY_LABELS } from '../../shared/util/labels';
import { ComparisonChart } from '../trips/comparison/comparison-chart';
import { ComparisonPanel } from '../trips/comparison/comparison-panel';

const MIN_TRAVELERS = 1;
const MAX_TRAVELERS = 9;

/**
 * Explore a route without saving anything: pick two cities on the map and the
 * comparison appears; priority, travelers and date re-run it. "Save as trip"
 * carries the selection to the trip form.
 */
@Component({
  selector: 'app-route-explorer',
  imports: [RouterLink, RouteMap, ComparisonChart, ComparisonPanel, ErrorMessage, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-explorer.html',
  styleUrl: './route-explorer.scss',
})
export class RouteExplorer {
  private readonly cityApi = inject(CityApi);
  private readonly comparisonApi = inject(ComparisonApi);

  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly today = todayIso();
  protected readonly minTravelers = MIN_TRAVELERS;
  protected readonly maxTravelers = MAX_TRAVELERS;

  protected readonly cities = rxResource({ stream: () => this.cityApi.findAll() });

  protected readonly originId = signal<number | null>(null);
  protected readonly destinationId = signal<number | null>(null);
  protected readonly priority = signal<TripPriority>('BALANCED');
  protected readonly travelers = signal(MIN_TRAVELERS);
  /** A week ahead by default: inside the weather forecast window. */
  protected readonly date = signal(addDaysIso(this.today, 7));

  /** Defined once both cities and a valid date are chosen; drives the comparison. */
  protected readonly request = computed<ComparisonRequest | undefined>(() => {
    const originCityId = this.originId();
    const destinationCityId = this.destinationId();
    const departureDate = this.date();
    if (originCityId === null || destinationCityId === null || departureDate < this.today) {
      return undefined;
    }
    return {
      originCityId,
      destinationCityId,
      departureDate,
      travelers: this.travelers(),
      priority: this.priority(),
    };
  });

  protected readonly comparison = rxResource({
    params: () => this.request(),
    stream: ({ params }) => this.comparisonApi.preview(params),
  });

  /** Query parameters that prefill the trip form with the current selection. */
  protected readonly saveParams = computed(() => {
    const request = this.request();
    return request
      ? {
          from: request.originCityId,
          to: request.destinationCityId,
          date: request.departureDate,
          travelers: request.travelers,
          priority: request.priority,
        }
      : null;
  });

  protected select(selection: RouteSelection): void {
    this.originId.set(selection.originId);
    this.destinationId.set(selection.destinationId);
  }

  protected swap(): void {
    const origin = this.originId();
    this.originId.set(this.destinationId());
    this.destinationId.set(origin);
  }

  protected clear(): void {
    this.select({ originId: null, destinationId: null });
  }

  protected changeTravelers(delta: number): void {
    this.travelers.update((value) =>
      Math.min(MAX_TRAVELERS, Math.max(MIN_TRAVELERS, value + delta)),
    );
  }

  protected setDate(value: string): void {
    if (value) {
      this.date.set(value);
    }
  }
}
