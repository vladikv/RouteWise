import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { City } from '../../core/api/models';
import { LAND_RINGS } from './europe-land';
import { Box, LabelRequest, LabelSide, PlacedLabel, layoutLabels } from './label-layout';
import { MapPoint, Projection, createProjection, haversineKm, routeArc } from './projection';
import {
  FitFrame,
  MAX_ZOOM,
  MIN_ZOOM,
  View,
  clampView,
  fitPoints,
  interpolateView,
  panBy,
  zoomAt,
  zoomOf,
} from './viewport';

export interface RouteSelection {
  originId: number | null;
  destinationId: number | null;
}

interface CityMarker {
  city: City;
  point: MapPoint;
  role: 'origin' | 'destination' | 'stop' | null;
  /** Text in the pin: "A"/"B", or the stop number(s) on a multi-stop route. */
  pin: string;
  label: PlacedLabel | null;
  ariaLabel: string;
  dimmed: boolean;
}

const WIDTH = 640;
const HEIGHT = 620;
const PADDING = 64;
const BASE: View = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
/** Longitudes covered by the land outline (see europe-land.ts); a wide map shows them all. */
const LAND_WEST = -30;
const LAND_EAST = 48;
const LAND_SOUTH = 33;
const LAND_NORTH = 63;
/** Kept between the view and the edge of the land data (drawing units), so the clipped coast never shows. */
const LAND_EDGE = 8;
/** Width (CSS pixels) over which the land fades into the sea at the edge of its data. */
const FADE_PX = 90;
/** A `wide` map switches to the wide view from this rendered width on (CSS pixels). */
const WIDE_MIN_PX = 720;
/** Space above the northernmost and below the southernmost city in the wide view (drawing units). */
const WIDE_MARGIN_Y = 36;
/** Space around the cities' bounding box in the fill view (drawing units). */
const COVER_MARGIN = 48;

/** Sizes in CSS pixels; they stay the same on screen at every zoom and map size. */
const LABEL_PX = 13;
const DOT_PX = 4.5;
/** Space kept around a route when the map zooms to it, in CSS pixels; more in fill mode, where controls float over the map. */
const FIT_MARGIN_PX = 70;
const FILL_FIT_MARGIN_PX = 96;
const ZOOM_STEP = 1.6;
/** A pointer that moves further than this between press and release is a drag, not a click. */
const DRAG_THRESHOLD_PX = 4;
const ANIMATION_MS = 380;

/**
 * Interactive map of the supported cities on a land outline. Pick a city for
 * the origin, another for the destination; a further pick starts a new route.
 * Zoom with the wheel, a pinch, the buttons or `+`/`-`/`0`; drag to move.
 * Labels never overlap: those that do not fit appear when zooming in. Arrow
 * keys move between cities. Presentational: the selection lives in the parent.
 *
 * With `interactive` false it shows one route, zoomed to fit, as an image.
 * With `stops`, it draws that ordered route leg by leg (numbered pins) instead of
 * an origin and a destination; a picked city is then reported with `cityPick`.
 * With `wide`, a map at least 720 px wide shows the whole land outline in a
 * landscape view instead of the near-square one (same projection, more to the
 * west and east), so it can span a full-width layout without growing too tall.
 */
@Component({
  selector: 'app-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fill]': 'fill()' },
  templateUrl: './route-map.html',
  styleUrls: ['./route-map.scss', './route-map-card.scss'],
})
export class RouteMap {
  readonly cities = input.required<City[]>();
  readonly originId = input<number | null>(null);
  readonly destinationId = input<number | null>(null);
  readonly interactive = input(true);
  readonly wide = input(false);
  /**
   * Layout hook: fill the width and height of the host instead of following the drawing's
   * aspect ratio. The view takes the host's aspect ratio and never leaves the land data, so
   * the map has no letterbox bands and no visible edges at any size.
   */
  readonly fill = input(false);
  /**
   * Layout hook: where the zoom buttons sit. `corner` is the top right; `bottom-end` the bottom
   * right, `insetEnd` pixels in from the edge so floating panels stay clear of it.
   */
  readonly controls = input<'corner' | 'bottom-end'>('corner');
  /**
   * In fill mode: pixels at the left and right covered by floating panels. The map is centred
   * between them and a route is fitted into the space they leave free.
   */
  readonly insetStart = input(0);
  readonly insetEnd = input(0);
  /** An ordered route of city ids (2+ stops); replaces origin/destination when given. */
  readonly stops = input<number[] | null>(null);
  /** In stops mode: a city the user picked on the map. */
  readonly cityPick = output<number>();
  readonly selectionChange = output<RouteSelection>();

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly view = signal<View>({ ...BASE });
  /** Rendered width of the drawing in CSS pixels; updated by a ResizeObserver. */
  private readonly renderedWidth = signal(WIDTH);
  private readonly renderedHeight = signal(0);
  protected readonly hoveredId = signal<number | null>(null);
  protected readonly reducedMotion = prefersReducedMotion();

  protected readonly viewBox = computed(() => {
    const { x, y, width, height } = this.view();
    return `${x} ${y} ${width} ${height}`;
  });
  protected readonly zoom = computed(() => zoomOf(this.view(), this.base()));
  protected readonly canZoomIn = computed(() => this.zoom() < MAX_ZOOM - 0.01);
  protected readonly canZoomOut = computed(() => this.zoom() > MIN_ZOOM + 0.01);
  /** Drawing units per CSS pixel, so marks and text keep their on-screen size. */
  protected readonly unit = computed(() => this.view().width / Math.max(this.renderedWidth(), 1));

  private readonly projection = computed<Projection>(() =>
    createProjection(this.cities(), WIDTH, HEIGHT, PADDING),
  );

  /** The whole-map view (zoom 1): near-square, or landscape for a wide map. */
  protected readonly base = computed<View>(() => {
    if (this.useFill()) {
      return this.coverView();
    }
    if (!this.wide() || this.renderedWidth() < WIDE_MIN_PX) {
      return BASE;
    }
    const project = this.projection();
    const west = project({ longitude: LAND_WEST, latitude: 50 }).x;
    const east = project({ longitude: LAND_EAST, latitude: 50 }).x;
    // Only the band the cities occupy (plus room for their labels), so the map stays low.
    const ys = this.cities().map((city) => project(city).y);
    const top = Math.max(Math.min(...ys) - WIDE_MARGIN_Y, 0);
    const bottom = Math.min(Math.max(...ys) + WIDE_MARGIN_Y, HEIGHT);
    return {
      x: Math.min(west, 0),
      y: top,
      width: Math.max(east, WIDTH) - Math.min(west, 0),
      height: bottom - top,
    };
  });
  /** The land data as a view, inset by {@link LAND_EDGE}: in fill mode the map never shows beyond it. */
  private readonly landBox = computed<View>(() => {
    const project = this.projection();
    const northWest = project({ longitude: LAND_WEST, latitude: LAND_NORTH });
    const southEast = project({ longitude: LAND_EAST, latitude: LAND_SOUTH });
    return {
      x: northWest.x + LAND_EDGE,
      y: northWest.y + LAND_EDGE,
      width: southEast.x - northWest.x - 2 * LAND_EDGE,
      height: southEast.y - northWest.y - 2 * LAND_EDGE,
    };
  });
  /** In fill mode the area the view may move in: all the land. Otherwise the base view. */
  private readonly bounds = computed<View>(() => (this.useFill() ? this.landBox() : this.base()));
  private readonly useFill = computed(() => this.fill() && this.renderedHeight() > 0);
  /** The container as seen by the route fit; undefined outside fill mode. */
  private readonly frame = computed<FitFrame | undefined>(() =>
    this.useFill()
      ? {
          width: this.renderedWidth(),
          height: this.renderedHeight(),
          start: this.insetStart(),
          end: this.insetEnd(),
        }
      : undefined,
  );
  /**
   * Fill mode, the whole-map view (zoom 1): the container's aspect ratio (no letterbox), all
   * cities in the area between the side insets. It may extend past the land data.
   */
  private readonly coverView = computed<View>(() => this.coverAt(this.fitUnit()));
  /**
   * Fill mode: the view shown at rest, the whole-map view but never larger than the land data,
   * so no edge of it can show at any aspect ratio. Cities it leaves out are reached by panning.
   */
  private readonly restView = computed<View>(() => {
    if (!this.useFill()) {
      return this.base();
    }
    const box = this.landBox();
    const unit = Math.min(
      this.fitUnit(),
      box.width / this.renderedWidth(),
      box.height / this.renderedHeight(),
    );
    const view = this.coverAt(unit);
    return clampView(view, view, box);
  });
  /** Drawing units per pixel at which all cities fit between the insets, with a margin. */
  private readonly fitUnit = computed(() => {
    const project = this.projection();
    const points = this.cities().map((city) => project(city));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const free = this.freeWidth();
    return Math.max(
      (Math.max(...xs) - Math.min(...xs) + 2 * COVER_MARGIN) / free,
      (Math.max(...ys) - Math.min(...ys) + 2 * COVER_MARGIN) / this.renderedHeight(),
    );
  });
  /** Width in pixels the panels leave free (never less than a small strip). */
  private freeWidth(): number {
    const width = this.renderedWidth();
    return Math.max(width - this.insetStart() - this.insetEnd(), Math.min(width, 240));
  }

  /** A view with the container's aspect ratio at `unit`, with the cities' centre in the free area. */
  private coverAt(unit: number): View {
    const project = this.projection();
    const points = this.cities().map((city) => project(city));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const width = this.renderedWidth();
    const height = this.renderedHeight();
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const freeCenter = this.insetStart() + this.freeWidth() / 2;
    return {
      x: centerX - unit * freeCenter,
      y: centerY - (unit * height) / 2,
      width: unit * width,
      height: unit * height,
    };
  }
  /**
   * Where the fill view reaches past the land data (after a route fit that needed more room than
   * the land has, or a zoom out), the land fades into the sea instead of ending in a hard edge.
   */
  protected readonly fades = computed(() => {
    const view = this.view();
    const box = this.landBox();
    const tolerance = 0.01; // rounding: a view that exactly fits the box is not beyond it
    const beyond =
      view.x < box.x - tolerance ||
      view.y < box.y - tolerance ||
      view.x + view.width > box.x + box.width + tolerance ||
      view.y + view.height > box.y + box.height + tolerance;
    if (!this.useFill() || !beyond) {
      return null;
    }
    const project = this.projection();
    const northWest = project({ longitude: LAND_WEST, latitude: LAND_NORTH });
    const southEast = project({ longitude: LAND_EAST, latitude: LAND_SOUTH });
    const size = FADE_PX * this.unit();
    // Reaches one stroke width past the data so the coast's clipped edge is covered completely.
    const outside = 3 * this.unit();
    return {
      west: northWest.x - outside,
      east: southEast.x + outside,
      north: northWest.y - outside,
      south: southEast.y + outside,
      size: size + outside,
      width: southEast.x - northWest.x + 2 * outside,
      height: southEast.y - northWest.y + 2 * outside,
    };
  });
  protected readonly isWideView = computed(() => this.base() !== BASE);
  protected readonly aspectRatio = computed(() => `${this.base().width} / ${this.base().height}`);
  private lastBase: View | null = null;
  private lastRoute: unknown = null;
  /** True once the user has zoomed or moved the map by hand since the last route or fit. */
  private adjusted = false;

  /** All land shapes as one SVG path in drawing coordinates. */
  protected readonly land = computed(() => landPath(this.projection()));

  private readonly points = computed(() => {
    const project = this.projection();
    return new Map(this.cities().map((city) => [city.id, project(city)]));
  });

  /** The cities on the route in order: the stops, or origin then destination. */
  private readonly routeCities = computed<City[]>(() => {
    const ids = this.stops() ?? [this.originId(), this.destinationId()];
    return ids.map((id) => this.cityById(id)).filter((city): city is City => city !== undefined);
  });

  /** The drawn route through every stop, or null with fewer than two. */
  protected readonly route = computed(() => {
    const cities = this.routeCities();
    if (cities.length < 2) {
      return null;
    }
    const points = cities.map((city) => this.points().get(city.id) as MapPoint);
    let path = '';
    let distanceKm = 0;
    for (let i = 0; i + 1 < cities.length; i++) {
      path += routeArc(points[i], points[i + 1]);
      distanceKm += haversineKm(cities[i], cities[i + 1]);
    }
    return { points, from: points[0], to: points[points.length - 1], path, distanceKm };
  });

  /** Pin text per city: "A"/"B", or stop numbers ("1", or "1, 5" on a round trip). */
  private readonly pins = computed(() => {
    const pins = new Map<number, string>();
    if (this.stops() === null) {
      const originId = this.originId();
      const destinationId = this.destinationId();
      if (originId !== null) {
        pins.set(originId, 'A');
      }
      if (destinationId !== null) {
        pins.set(destinationId, 'B');
      }
      return pins;
    }
    this.routeCities().forEach((city, index) => {
      const existing = pins.get(city.id);
      pins.set(city.id, existing ? `${existing}, ${index + 1}` : String(index + 1));
    });
    return pins;
  });

  protected readonly markers = computed<CityMarker[]>(() => {
    const unit = this.unit();
    const view = this.view();
    const points = this.points();
    const route = this.route();
    const pins = this.pins();
    const stopsMode = this.stops() !== null;

    const inView = (p: MapPoint) =>
      p.x >= view.x && p.x <= view.x + view.width && p.y >= view.y && p.y <= view.y + view.height;
    const requests: LabelRequest[] = this.cities()
      .filter((city) => inView(points.get(city.id) as MapPoint))
      .map((city) => {
        const point = points.get(city.id) as MapPoint;
        const pinned = pins.has(city.id);
        return {
          id: city.id,
          x: point.x,
          y: point.y,
          text: city.name,
          pinned,
          preferred:
            pinned && route && !stopsMode
              ? routeLabelSides(point, route.from, route.to)
              : undefined,
        };
      });
    const interactive = this.interactive();
    const edge = 4 * unit;
    const right = view.x + view.width;
    const bottom = view.y + view.height;
    const labels = layoutLabels(requests, {
      fontSize: LABEL_PX * unit,
      dotRadius: (DOT_PX + 2) * unit,
      bounds: {
        left: view.x + edge,
        top: view.y + edge,
        right: right - edge,
        bottom: bottom - edge,
      },
      reserved: interactive ? this.controlZones(view, unit) : [],
    });

    const routeCities = this.routeCities();
    return this.cities().map((city) => {
      const pin = pins.get(city.id) ?? '';
      const role = this.roleOf(city.id, stopsMode, routeCities);
      return {
        city,
        point: points.get(city.id) as MapPoint,
        role,
        pin,
        label: labels.get(city.id) ?? null,
        ariaLabel: !role
          ? city.name
          : stopsMode
            ? `${city.name}, stop ${pin}`
            : `${city.name}, ${role}`,
        dimmed: route !== null && role === null,
      };
    });
  });

  /** Where the zoom buttons and the hint cover the drawing, so no label is placed there. */
  private controlZones(view: View, unit: number): Box[] {
    const right = view.x + view.width;
    const bottom = view.y + view.height;
    if (this.controls() === 'corner') {
      return [
        { left: right - 60 * unit, top: view.y, right, bottom: view.y + 140 * unit },
        { left: view.x, top: bottom - 30 * unit, right: view.x + 240 * unit, bottom },
      ];
    }
    const end = right - this.insetEnd() * unit;
    const middle =
      view.x +
      (this.insetStart() + (view.width / unit - this.insetStart() - this.insetEnd()) / 2) * unit;
    return [
      { left: end - 60 * unit, top: bottom - 140 * unit, right: end, bottom },
      { left: middle - 120 * unit, top: bottom - 30 * unit, right: middle + 120 * unit, bottom },
    ];
  }

  /** Details for the city under the pointer or keyboard focus, positioned over the map. */
  protected readonly card = computed(() => {
    const city = this.cityById(this.hoveredId());
    if (!city || !this.interactive()) {
      return null;
    }
    const point = this.points().get(city.id) as MapPoint;
    const view = this.view();
    const origin = this.cityById(this.originId());
    const left = ((point.x - view.x) / view.width) * 100;
    const top = ((point.y - view.y) / view.height) * 100;
    let hint: string;
    if (this.stops() !== null) {
      const pin = this.pins().get(city.id);
      hint = pin ? `Stop ${pin} · select to add again` : 'Select to add as the next stop';
    } else if (city.id === this.originId()) {
      hint = this.destinationId() === null ? 'Origin · select again to clear' : 'Origin';
    } else if (city.id === this.destinationId()) {
      hint = 'Destination';
    } else if (this.originId() === null || this.destinationId() !== null) {
      hint = 'Select to start here';
    } else {
      hint = 'Select as destination';
    }
    return {
      city,
      hint,
      distanceKm: origin && origin.id !== city.id ? haversineKm(origin, city) : null,
      left: Math.min(Math.max(left, 12), 88),
      top,
      below: top < 22,
    };
  });

  /** Text equivalent of what the map shows; announced when the selection changes. */
  protected readonly description = computed(() => {
    if (this.stops() !== null) {
      const cities = this.routeCities();
      const route = this.route();
      if (route) {
        return `Route ${cities.map((city) => city.name).join(' → ')}, ${Math.round(route.distanceKm)} km straight-line.`;
      }
      return cities.length === 1
        ? `Stop 1: ${cities[0].name}. Add another stop.`
        : 'Choose the stops.';
    }
    const origin = this.cityById(this.originId());
    const destination = this.cityById(this.destinationId());
    const route = this.route();
    if (origin && destination && route) {
      return `Route from ${origin.name} to ${destination.name}, ${Math.round(route.distanceKm)} km straight-line.`;
    }
    if (origin) {
      return `Origin: ${origin.name}. Choose a destination.`;
    }
    return 'Choose an origin city.';
  });

  private animationFrame = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pressStart: { x: number; y: number } | null = null;
  private dragged = false;
  private pinchDistance = 0;

  constructor() {
    afterNextRender(() => this.observeSize());
    this.destroyRef.onDestroy(() => this.stopAnimation());

    // Zoom to a newly chosen route; back out when it is cleared. When only the size of the map or
    // the space the panels leave changes (a layout switch, a resize), a view the user has moved is
    // kept (same centre, same zoom relative to the whole map) and otherwise the route is fitted
    // again, without animation.
    effect(() => {
      const route = this.route();
      const interactive = this.interactive();
      const base = this.base();
      const rest = this.restView();
      const frame = this.frame();
      const bounds = this.bounds();
      untracked(() => {
        const routeChanged = route !== this.lastRoute;
        const baseChanged = base !== this.lastBase;
        const previousBase = this.lastBase;
        this.lastRoute = route;
        this.lastBase = base;
        if (routeChanged) {
          this.adjusted = false;
        } else if (this.adjusted) {
          if (baseChanged && previousBase) {
            this.keepView(previousBase, base, bounds);
          }
          return;
        }
        const animate = interactive && !baseChanged;
        if (route) {
          this.moveTo(fitPoints(route.points, base, this.fitMargin(base), frame, bounds), animate);
        } else if (baseChanged || this.routeCities().length === 0) {
          this.moveTo({ ...rest }, animate);
        }
      });
    });
  }

  // --- Selection ---------------------------------------------------------------

  protected pick(city: City): void {
    if (!this.interactive() || this.consumeDrag()) {
      return;
    }
    if (this.stops() !== null) {
      this.cityPick.emit(city.id);
      return;
    }
    const originId = this.originId();
    const destinationId = this.destinationId();
    if (originId === null) {
      // Keeps a destination that was chosen first (e.g. in a picker).
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

  protected pickWithKey(event: Event, city: City): void {
    event.preventDefault(); // Space would otherwise scroll the page
    this.pick(city);
  }

  // --- Zoom buttons and keys ------------------------------------------------------

  protected zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  protected zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  private zoomBy(factor: number): void {
    this.adjusted = true;
    this.moveTo(zoomAt(this.view(), this.base(), factor, this.center(), this.bounds()), true);
  }

  /** Shows the whole route, or the whole map when there is none. */
  protected fit(): void {
    const route = this.route();
    const base = this.base();
    this.adjusted = false;
    this.moveTo(
      route
        ? fitPoints(route.points, base, this.fitMargin(base), this.frame(), this.bounds())
        : { ...this.restView() },
      true,
    );
  }

  /** Space kept around a route, in drawing units at the whole-map scale. */
  private fitMargin(base: View): number {
    const margin = this.useFill() ? FILL_FIT_MARGIN_PX : FIT_MARGIN_PX;
    return margin * (base.width / Math.max(this.renderedWidth(), 1));
  }

  /** After the whole-map view changed: same centre, same zoom relative to it. */
  private keepView(previousBase: View, base: View, bounds: View): void {
    const view = this.view();
    const zoom = zoomOf(view, previousBase);
    const width = base.width / zoom;
    const height = base.height / zoom;
    this.moveTo(
      clampView(
        {
          x: view.x + view.width / 2 - width / 2,
          y: view.y + view.height / 2 - height / 2,
          width,
          height,
        },
        base,
        bounds,
      ),
      false,
    );
  }

  protected onMapKey(event: KeyboardEvent): void {
    if (event.key === '+' || event.key === '=') {
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      this.zoomOut();
    } else if (event.key === '0') {
      this.fit();
    } else {
      return;
    }
    event.preventDefault();
  }

  /** Arrow keys move focus to the nearest city in that direction. */
  protected onCityArrow(event: KeyboardEvent, city: City): void {
    const direction = ARROWS[event.key];
    if (!direction) {
      return;
    }
    event.preventDefault();
    const next = nearestInDirection(city, direction, this.cities(), this.points());
    if (next) {
      this.focusCity(next.id);
    }
  }

  // --- Pointer: wheel, drag, pinch -----------------------------------------------

  protected onWheel(event: WheelEvent): void {
    if (!this.interactive()) {
      return;
    }
    event.preventDefault(); // zoom the map instead of scrolling the page
    const factor = Math.exp(-event.deltaY * 0.0018);
    this.stopAnimation();
    this.adjusted = true;
    this.view.set(zoomAt(this.view(), this.base(), factor, this.toDrawing(event), this.bounds()));
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.interactive() || event.button !== 0) {
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.pressStart = { x: event.clientX, y: event.clientY };
      this.dragged = false;
    } else if (this.pointers.size === 2) {
      this.pinchDistance = this.pointerSpread();
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) {
      return;
    }
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2) {
      const spread = this.pointerSpread();
      if (this.pinchDistance > 0 && spread > 0) {
        const [a, b] = [...this.pointers.values()];
        const middle = this.toDrawing({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
        this.adjusted = true;
        this.view.set(
          zoomAt(this.view(), this.base(), spread / this.pinchDistance, middle, this.bounds()),
        );
      }
      this.pinchDistance = spread;
      this.dragged = true;
      return;
    }

    const start = this.pressStart;
    if (start && !this.dragged) {
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved < DRAG_THRESHOLD_PX) {
        return;
      }
      this.dragged = true;
      // Captured only once it is a drag, so a plain click still reaches the city.
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    }
    this.stopAnimation();
    this.adjusted = true;
    const unit = this.unit();
    this.view.set(
      panBy(
        this.view(),
        this.base(),
        -(event.clientX - previous.x) * unit,
        -(event.clientY - previous.y) * unit,
        this.bounds(),
      ),
    );
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) {
      this.pinchDistance = 0;
    }
    if (this.pointers.size === 0) {
      this.pressStart = null;
    }
  }

  // --- Helpers --------------------------------------------------------------------

  /** First stop is the origin, last the destination, the rest plain stops. */
  private roleOf(id: number, stopsMode: boolean, routeCities: City[]): CityMarker['role'] {
    if (!stopsMode) {
      return id === this.originId() ? 'origin' : id === this.destinationId() ? 'destination' : null;
    }
    if (!routeCities.some((city) => city.id === id)) {
      return null;
    }
    if (routeCities[0].id === id) {
      return 'origin';
    }
    return routeCities[routeCities.length - 1].id === id ? 'destination' : 'stop';
  }

  private cityById(id: number | null): City | undefined {
    return id === null ? undefined : this.cities().find((city) => city.id === id);
  }

  /** True once after a drag, so the click that ends a drag does not select a city. */
  private consumeDrag(): boolean {
    const wasDrag = this.dragged;
    this.dragged = false;
    return wasDrag;
  }

  private center(): MapPoint {
    const view = this.view();
    return { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  }

  private toDrawing(event: { clientX: number; clientY: number }): MapPoint {
    const rect = this.svg()?.nativeElement.getBoundingClientRect();
    const view = this.view();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return this.center();
    }
    return {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.width,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.height,
    };
  }

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private focusCity(id: number): void {
    const element = this.host.nativeElement.querySelector<SVGGElement>(`g.city[data-id="${id}"]`);
    element?.focus();
    this.hoveredId.set(id);
    const point = this.points().get(id);
    const view = this.view();
    if (
      point &&
      (point.x < view.x ||
        point.x > view.x + view.width ||
        point.y < view.y ||
        point.y > view.y + view.height)
    ) {
      this.adjusted = true;
      this.moveTo(
        panBy(
          view,
          this.base(),
          point.x - (view.x + view.width / 2),
          point.y - (view.y + view.height / 2),
          this.bounds(),
        ),
        true,
      );
    }
  }

  private moveTo(target: View, animate: boolean): void {
    this.stopAnimation();
    if (!animate || this.reducedMotion || typeof requestAnimationFrame === 'undefined') {
      this.view.set(target);
      return;
    }
    const from = this.view();
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / ANIMATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      this.view.set(interpolateView(from, target, eased));
      if (t < 1) {
        this.animationFrame = requestAnimationFrame(step);
      }
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  private observeSize(): void {
    const element = this.svg()?.nativeElement;
    if (!element) {
      return;
    }
    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0) {
        this.renderedWidth.set(width);
        this.renderedHeight.set(this.fill() ? height : 0);
      }
    };
    update();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}

const ARROWS: Record<string, MapPoint> = {
  ArrowRight: { x: 1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** Nearest city whose direction is within 60° of `direction`, preferring straighter lines. */
export function nearestInDirection(
  from: City,
  direction: MapPoint,
  cities: City[],
  points: Map<number, MapPoint>,
): City | null {
  const origin = points.get(from.id);
  if (!origin) {
    return null;
  }
  let best: { city: City; score: number } | null = null;
  for (const city of cities) {
    const point = points.get(city.id);
    if (city.id === from.id || !point) {
      continue;
    }
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const distance = Math.hypot(dx, dy);
    const cosine = (dx * direction.x + dy * direction.y) / distance;
    if (cosine < 0.5) {
      continue; // more than 60° off
    }
    const score = distance * (2 - cosine);
    if (!best || score < best.score) {
      best = { city, score };
    }
  }
  return best?.city ?? null;
}

/** Keeps the two route labels on the outer side of each end, away from the line. */
function routeLabelSides(point: MapPoint, from: MapPoint, to: MapPoint): LabelSide[] {
  const other = point === from ? to : from;
  const dx = other.x - point.x;
  const dy = other.y - point.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0 ? ['top', 'left', 'right'] : ['bottom', 'right', 'left'];
  }
  return dx > 0 ? ['left', 'top', 'bottom'] : ['right', 'top', 'bottom'];
}

function landPath(project: Projection): string {
  const parts: string[] = [];
  for (const ring of LAND_RINGS) {
    let segment = '';
    for (let i = 0; i < ring.length; i += 2) {
      const { x, y } = project({ longitude: ring[i], latitude: ring[i + 1] });
      segment += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    parts.push(segment + 'Z');
  }
  return parts.join('');
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
