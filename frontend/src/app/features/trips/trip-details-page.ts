import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { CityApi } from '../../core/api/city-api';
import { Comparison, Trip } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { RouteMap } from '../../shared/map/route-map';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { PRIORITY_LABELS, travelersLabel } from '../../shared/util/labels';
import { TripDeleteDialog } from './trip-delete-dialog';
import { DeletionHooks, TripDeletion } from './trip-deletion';
import { AdvicePanel } from './comparison/advice-panel';
import { ComparisonChart } from './comparison/comparison-chart';
import { ComparisonPanel } from './comparison/comparison-panel';
import { ItineraryView } from './comparison/itinerary-view';
import { LegComparison, legComparison } from './comparison/leg-comparison';

/** One trip: details, the advisor's recommendation, the mode comparison, and edit and delete. */
@Component({
  selector: 'app-trip-details-page',
  imports: [
    DatePipe,
    RouterLink,
    AdvicePanel,
    ComparisonChart,
    ComparisonPanel,
    ErrorMessage,
    ItineraryView,
    RouteMap,
    Spinner,
    TripDeleteDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-details-page.html',
  styleUrl: './trip-details-page.scss',
  providers: [TripDeletion],
})
export class TripDetailsPage {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly tripApi = inject(TripApi);
  private readonly cityApi = inject(CityApi);
  private readonly router = inject(Router);

  protected readonly trip = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.tripApi.findById(Number(id)),
  });
  /** Loaded once the trip exists, so an unknown trip shows a single error. */
  protected readonly comparison = rxResource({
    params: () => this.trip.value()?.id,
    stream: ({ params: id }) => this.tripApi.compare(id),
  });
  protected readonly advice = rxResource({
    params: () => this.trip.value()?.id,
    stream: ({ params: id }) => this.tripApi.advise(id),
  });
  /** For the route map; the page works without it, so its failure is not shown. */
  protected readonly cities = rxResource({ stream: () => this.cityApi.findAll() });
  protected readonly deletion = inject(TripDeletion);
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly travelersLabel = travelersLabel;
  /** The stop cities in order, for the map. */
  protected readonly stopIds = computed(
    () => this.trip.value()?.stops.map((stop) => stop.cityId) ?? [],
  );

  protected singleLeg(comparison: Comparison): LegComparison {
    return legComparison(comparison, 0);
  }

  /** After the delete the page leaves for the list; Undo brings the user back to the restored trip. */
  private readonly deletionHooks: DeletionHooks = {
    deleted: () => void this.router.navigate(['/trips']),
    restored: (trip: Trip) => void this.router.navigate(['/trips', trip.id]),
  };

  protected confirmDelete(): void {
    this.deletion.confirm(this.deletionHooks);
  }
}
