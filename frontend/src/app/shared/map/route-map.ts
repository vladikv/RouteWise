import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { City } from '../../core/api/models';
import { MapPoint, createProjection, haversineKm, routeArc } from './projection';

export interface RouteSelection {
  originId: number | null;
  destinationId: number | null;
}

type LabelSide = 'right' | 'left' | 'top' | 'bottom';

interface CityMarker {
  city: City;
  point: MapPoint;
  role: 'origin' | 'destination' | null;
  label: { x: number; y: number; anchor: 'start' | 'end' | 'middle' };
  ariaLabel: string;
}

const WIDTH = 640;
const HEIGHT = 620;
const PADDING = 64;
const STATIC_WIDTH = 340;
const STATIC_HEIGHT = 260;
const STATIC_PADDING = 64;

/** Where a label sits when the default (right of the dot) would collide with a neighbour. */
const LABEL_SIDES: Record<string, LabelSide> = {
  Amsterdam: 'top',
  Brussels: 'left',
  Frankfurt: 'bottom',
  Hamburg: 'top',
  Prague: 'top',
  Vienna: 'bottom',
  Venice: 'bottom',
  Milan: 'left',
  Munich: 'top',
  Zurich: 'left',
  Lyon: 'left',
  Paris: 'left',
  London: 'left',
  Lisbon: 'top',
  Warsaw: 'top',
};

/**
 * Map of the supported cities, placed from their coordinates. When interactive,
 * each city is a button: the first pick is the origin, the second the
 * destination, and a further pick starts a new route. Presentational; the
 * selection lives in the parent.
 */
@Component({
  selector: 'app-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-map.html',
  styleUrl: './route-map.scss',
})
export class RouteMap {
  readonly cities = input.required<City[]>();
  readonly originId = input<number | null>(null);
  readonly destinationId = input<number | null>(null);
  /** False shows the route only: no buttons, one image with a text description. */
  readonly interactive = input(true);
  readonly selectionChange = output<RouteSelection>();

  /**
   * What the map frames. Interactive: all cities, so any can be picked. Read-only
   * with a route: zoomed to the route's two cities, in a smaller drawing that
   * stays legible in a narrow column; other cities appear only if they fall inside.
   */
  private readonly frame = computed(() => {
    const cities = this.cities();
    const ends = cities.filter(
      (city) => city.id === this.originId() || city.id === this.destinationId(),
    );
    return !this.interactive() && ends.length === 2
      ? { width: STATIC_WIDTH, height: STATIC_HEIGHT, padding: STATIC_PADDING, fit: ends }
      : { width: WIDTH, height: HEIGHT, padding: PADDING, fit: cities };
  });

  protected readonly viewBox = computed(() => `0 0 ${this.frame().width} ${this.frame().height}`);

  protected readonly markers = computed<CityMarker[]>(() => {
    const frame = this.frame();
    const zoomed = frame.fit.length !== this.cities().length;
    const project = createProjection(frame.fit, frame.width, frame.height, frame.padding);
    const points = new Map(this.cities().map((city) => [city.id, project(city)]));
    const originY = points.get(this.originId() ?? -1)?.y ?? 0;
    const destinationY = points.get(this.destinationId() ?? -1)?.y ?? 0;

    return this.cities()
      .map((city) => {
        const point = points.get(city.id) as MapPoint;
        const role: CityMarker['role'] =
          city.id === this.originId()
            ? 'origin'
            : city.id === this.destinationId()
              ? 'destination'
              : null;
        // Zoomed in, the two names go above the northern and below the southern city,
        // clear of the route between them.
        const northern = role === 'origin' ? originY <= destinationY : destinationY < originY;
        const side: LabelSide =
          zoomed && role ? (northern ? 'top' : 'bottom') : (LABEL_SIDES[city.name] ?? 'right');
        return {
          city,
          point,
          role,
          label: labelPosition(point, side),
          ariaLabel: role ? `${city.name}, ${role}` : city.name,
        };
      })
      .filter(
        (marker) =>
          marker.point.x >= 0 &&
          marker.point.x <= frame.width &&
          marker.point.y >= 0 &&
          marker.point.y <= frame.height,
      );
  });

  protected readonly origin = computed(() => this.markers().find((m) => m.role === 'origin'));
  protected readonly destination = computed(() =>
    this.markers().find((m) => m.role === 'destination'),
  );

  protected readonly route = computed(() => {
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination) {
      return null;
    }
    return {
      path: routeArc(origin.point, destination.point),
      distanceKm: haversineKm(origin.city, destination.city),
    };
  });

  /** Text equivalent of what the map shows; announced when the selection changes. */
  protected readonly description = computed(() => {
    const origin = this.origin();
    const destination = this.destination();
    const route = this.route();
    if (origin && destination && route) {
      return `Route from ${origin.city.name} to ${destination.city.name}, ${Math.round(route.distanceKm)} km straight-line.`;
    }
    if (origin) {
      return `Origin: ${origin.city.name}. Choose a destination.`;
    }
    return 'Choose an origin city.';
  });

  protected pick(city: City): void {
    if (!this.interactive()) {
      return;
    }
    const originId = this.originId();
    const destinationId = this.destinationId();
    if (originId === null) {
      // Keeps a destination that was chosen first (e.g. in the form's dropdown).
      this.selectionChange.emit({
        originId: city.id,
        destinationId: destinationId === city.id ? null : destinationId,
      });
    } else if (destinationId === null) {
      this.selectionChange.emit(
        city.id === originId
          ? { originId: null, destinationId: null }
          : { originId, destinationId: city.id },
      );
    } else {
      this.selectionChange.emit({ originId: city.id, destinationId: null });
    }
  }

  protected pickWithSpace(event: Event, city: City): void {
    event.preventDefault(); // Space would otherwise scroll the page
    this.pick(city);
  }
}

function labelPosition(point: MapPoint, side: LabelSide): CityMarker['label'] {
  switch (side) {
    case 'left':
      return { x: point.x - 12, y: point.y + 4, anchor: 'end' };
    case 'top':
      return { x: point.x, y: point.y - 13, anchor: 'middle' };
    case 'bottom':
      return { x: point.x, y: point.y + 22, anchor: 'middle' };
    default:
      return { x: point.x + 12, y: point.y + 4, anchor: 'start' };
  }
}
