import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
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
import { DOCUMENT } from '@angular/common';
import { GeoPermissibleObjects, geoGraticule, geoPath } from 'd3-geo';
import { City } from '../../core/api/models';
import { hitRadii, thinOut } from './city-density';
import { Box, LabelRequest, LabelSide, PlacedLabel, layoutLabels } from './label-layout';
import {
  DEFAULT_VIEW,
  GlobeFrame,
  GlobeView,
  MAX_ZOOM,
  MIN_ZOOM,
  MapPoint,
  clampZoom,
  createGlobeProjection,
  fitRoute,
  globeGeometry,
  greatCircle,
  haversineKm,
  interpolateView,
  isVisible,
  maxLabelRank,
  rotateBy,
  rotateByDegrees,
} from './globe';

/** Loads the land shapes; its own chunk. Replaced in tests. */
export const LAND_LOADER = new InjectionToken<
  () => Promise<{ LAND_RINGS: readonly (readonly number[])[] }>
>('LAND_LOADER', { providedIn: 'root', factory: () => () => import('./world-land') });

/** Something floating over the top of the map (the layout toolbar) that labels must keep clear of. */
export interface TopZone {
  /** CSS pixels. */
  width: number;
  height: number;
  align: 'start' | 'center';
}

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
  /** Radius of the invisible click target, kept clear of the neighbouring cities. */
  hitRadius: number;
}

/** Size used until the map has been measured (and where there is no layout, as in tests). */
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 620;
/** A `wide` map switches to the landscape shape from this rendered width on (CSS pixels). */
const WIDE_MIN_PX = 720;

/** Sizes in CSS pixels. */
const LABEL_PX = 13;
const DOT_PX = 4.5;
/** Space kept around a route when the map zooms to it, in CSS pixels; more in fill mode, where controls float over the map. */
const FIT_MARGIN_PX = 70;
const FILL_FIT_MARGIN_PX = 96;
/** Cities this far outside the drawing are not rendered (so they cannot take focus either). */
const OFFSCREEN_PX = 24;
/** The click target of a city: as large as the nearest neighbour allows, between these. */
const HIT_MIN_PX = DOT_PX + 2;
const HIT_MAX_PX = 17;
/** Cities above the zoom's label rank are left out when they sit this close to a kept one. */
const CROWDED_PX = DOT_PX * 2.5;
/** What the zoom buttons cover (CSS pixels): labels keep clear of it. */
const ZOOM_ZONE_WIDTH_PX = 68;
const ZOOM_ZONE_HEIGHT_PX = 176;
const SCROLL_HINT_MS = 1600;
const ZOOM_STEP = 1.6;
const KEY_ROTATE_DEGREES = 20;
/** A pointer that moves further than this between press and release is a drag, not a click. */
const DRAG_THRESHOLD_PX = 4;
const ANIMATION_MS = 700;

type LandState = 'loading' | 'ready' | 'failed';

/**
 * Interactive globe of the supported cities. Pick a city for the origin, another for the
 * destination; a further pick starts a new route. Drag to rotate; zoom with the wheel, a pinch,
 * the buttons or `+`/`-`; `0` or "Reset view" goes back to the route (or Europe). Arrow keys
 * rotate the globe, or move between cities when one has focus. Cities on the far side are not
 * drawn. Labels never overlap: the less important ones appear when zooming in. Presentational:
 * the selection lives in the parent.
 *
 * With `interactive` false it shows one route, turned and zoomed to fit, as an image.
 * With `stops`, it draws that ordered route leg by leg (numbered pins) instead of
 * an origin and a destination; a picked city is then reported with `cityPick`.
 * With `wide`, a map at least 720 px wide takes a landscape shape instead of the near-square one.
 */
@Component({
  selector: 'app-route-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.fill]': 'fill()', '(document:keydown.escape)': 'dismissCard()' },
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
   * Layout hook: fill the width and height of the host instead of following a fixed aspect
   * ratio. The globe is centred in the space the panels leave free.
   */
  readonly fill = input(false);
  /**
   * Layout hook: where the zoom buttons sit. `corner` is the top right; `bottom-end` the bottom
   * right, `insetEnd` pixels in from the edge so floating panels stay clear of it.
   */
  readonly controls = input<'corner' | 'bottom-end'>('corner');
  /**
   * In fill mode: pixels at the left and right covered by floating panels. The globe is centred
   * between them and a route is fitted into the space they leave free.
   */
  readonly insetStart = input(0);
  readonly insetEnd = input(0);
  /**
   * `greedy`: the wheel always zooms the globe. `cooperative` (a map inside a scrolling page):
   * only Ctrl/Cmd + wheel zooms, a plain wheel scrolls the page, and a vertical swipe scrolls it too.
   */
  readonly gestures = input<'greedy' | 'cooperative'>('greedy');
  /** A toolbar floating over the top of the map; labels stay clear of it. */
  readonly topZone = input<TopZone | null>(null);
  /** An ordered route of city ids (2+ stops); replaces origin/destination when given. */
  readonly stops = input<number[] | null>(null);
  /** In stops mode: a city the user picked on the map. */
  readonly cityPick = output<number>();
  readonly selectionChange = output<RouteSelection>();

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly loadLand = inject(LAND_LOADER);

  /** What the globe shows: the point in the middle of the disc and the zoom. Changes every frame while turning. */
  protected readonly view = signal<GlobeView>({ ...DEFAULT_VIEW });
  /** Rendered size of the drawing in CSS pixels; updated by a ResizeObserver. */
  private readonly renderedWidth = signal(DEFAULT_WIDTH);
  private readonly renderedHeight = signal(DEFAULT_HEIGHT);
  protected readonly hoveredId = signal<number | null>(null);
  /** Follows the system setting live, like the theme. */
  private readonly reducedMotion = signal(false);
  /** Land shapes as GeoJSON; loaded on demand (its own chunk), the globe shows only the sea until then. */
  private readonly landShapes = signal<GeoPermissibleObjects | null>(null);
  protected readonly landState = signal<LandState>('loading');
  protected readonly scrollHint = signal(false);
  /** The city that had focus last: it stays the one tab stop of the map. */
  private readonly lastFocusedId = signal<number | null>(null);

  protected readonly cooperative = computed(() => this.gestures() === 'cooperative');
  protected readonly instructions = computed(() => {
    const choose =
      this.stops() !== null
        ? 'Select a city to add it as the next stop.'
        : 'Choose an origin, then a destination.';
    return `Globe of cities. ${choose} Tab to the cities, arrow keys move between them. Arrow keys rotate the globe when no city has focus, plus and minus zoom, zero resets the view.`;
  });

  protected readonly zoom = computed(() => this.view().zoom);
  protected readonly canZoomIn = computed(() => this.zoom() < MAX_ZOOM - 0.01);
  protected readonly canZoomOut = computed(() => this.zoom() > MIN_ZOOM + 0.01);

  protected readonly isWideView = computed(
    () => this.wide() && this.renderedWidth() >= WIDE_MIN_PX,
  );
  protected readonly aspectRatio = computed(() =>
    this.isWideView() ? '16 / 9' : `${DEFAULT_WIDTH} / ${DEFAULT_HEIGHT}`,
  );

  private readonly frame = computed<GlobeFrame>(() => ({
    width: this.renderedWidth(),
    height: this.renderedHeight(),
    start: this.fill() ? this.insetStart() : 0,
    end: this.fill() ? this.insetEnd() : 0,
  }));
  private readonly geometry = computed(() => globeGeometry(this.frame()));
  private readonly projection = computed(() => createGlobeProjection(this.view(), this.geometry()));
  private readonly pathOf = computed(() => geoPath(this.projection()));

  /** The globe's disc. */
  protected readonly disc = computed(() => ({
    cx: this.geometry().centerX,
    cy: this.geometry().centerY,
    r: this.geometry().baseRadius * this.view().zoom,
  }));
  protected readonly land = computed(() => {
    const shapes = this.landShapes();
    return shapes ? (this.pathOf()(shapes) ?? '') : '';
  });
  protected readonly graticule = computed(() => this.pathOf()(GRATICULE) ?? '');

  /** Cities by importance: label rank, then capitals, then name. */
  private readonly ranked = computed(() =>
    [...this.cities()].sort(
      (a, b) =>
        a.labelRank - b.labelRank ||
        Number(b.capital) - Number(a.capital) ||
        a.name.localeCompare(b.name),
    ),
  );

  /** The cities on the visible half of the globe and inside the drawing, in label priority order. */
  private readonly placed = computed(() => {
    const view = this.view();
    const projection = this.projection();
    const height = this.renderedHeight();
    const free = this.freeSpan();
    const placed: { city: City; point: MapPoint }[] = [];
    for (const city of this.ranked()) {
      if (!isVisible(city, view)) {
        continue;
      }
      const projected = projection([city.longitude, city.latitude]);
      if (
        projected &&
        projected[0] >= free.left &&
        projected[0] <= free.right &&
        projected[1] >= -OFFSCREEN_PX &&
        projected[1] <= height + OFFSCREEN_PX
      ) {
        placed.push({ city, point: { x: projected[0], y: projected[1] } });
      }
    }
    return placed;
  });

  /**
   * The horizontal span where cities are drawn: the drawing and a little beyond it, or, in fill
   * mode, only the space the floating panels leave free (a city under a panel cannot be reached).
   */
  private readonly freeSpan = computed(() => {
    const width = this.renderedWidth();
    const left = this.insetStart();
    const right = width - this.insetEnd();
    // Panels that cover everything (a map not measured yet) limit nothing.
    return this.fill() && right - left > OFFSCREEN_PX
      ? { left, right }
      : { left: -OFFSCREEN_PX, right: width + OFFSCREEN_PX };
  });

  /**
   * What is drawn: the placed cities without the crowded low-ranked ones (they stay reachable
   * through the city pickers, and their dots would block better labels). A map that is only an
   * image shows just the route.
   */
  private readonly shown = computed(() => {
    const pins = this.pins();
    const interactive = this.interactive();
    return thinOut(
      this.placed().filter(({ city }) => interactive || pins.has(city.id)),
      {
        point: (item) => item.point,
        rank: (item) => item.city.labelRank,
        pinned: (item) => pins.has(item.city.id),
        maxRank: maxLabelRank(this.zoom()),
        minDistance: CROWDED_PX,
      },
    );
  });

  /** Screen position of every city that is drawn (and so can be focused). */
  private readonly points = computed(
    () => new Map(this.shown().map(({ city, point }) => [city.id, point])),
  );

  /** The cities on the route in order: the stops, or origin then destination. */
  private readonly routeCities = computed<City[]>(() => {
    const ids = this.stops() ?? [this.originId(), this.destinationId()];
    return ids.map((id) => this.cityById(id)).filter((city): city is City => city !== undefined);
  });
  private readonly routeKey = computed(() =>
    this.routeCities()
      .map((city) => city.id)
      .join(','),
  );
  /** The view that shows the whole route, or Europe when no city is chosen. */
  private readonly homeView = computed(() =>
    fitRoute(this.routeCities(), this.frame(), this.fill() ? FILL_FIT_MARGIN_PX : FIT_MARGIN_PX),
  );

  /** The route through every stop as great-circle arcs, one per leg; null with fewer than two stops. */
  protected readonly route = computed(() => {
    const cities = this.routeCities();
    if (cities.length < 2) {
      return null;
    }
    const arcs = cities.slice(1).map((city, i) => greatCircle(cities[i], city));
    const distanceKm = cities
      .slice(1)
      .reduce((sum, city, i) => sum + haversineKm(cities[i], city), 0);
    return { arcs, distanceKm };
  });

  /** One SVG path per leg through the current projection; the part behind the horizon is cut off. */
  protected readonly legPaths = computed(() => {
    const route = this.route();
    const pathOf = this.pathOf();
    return route
      ? route.arcs.map(
          (coordinates) =>
            pathOf({ type: 'LineString', coordinates } as GeoPermissibleObjects) ?? '',
        )
      : [];
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
    const view = this.view();
    const pins = this.pins();
    const route = this.route();
    const stopsMode = this.stops() !== null;
    const interactive = this.interactive();
    const routeCities = this.routeCities();
    const width = this.renderedWidth();
    const height = this.renderedHeight();
    const maxRank = maxLabelRank(view.zoom);
    const origin = this.cityById(this.originId());
    const destination = this.cityById(this.destinationId());
    const screen = this.points();

    const shown = this.shown();
    const hitRadius = hitRadii(
      shown.map(({ point }) => point),
      HIT_MIN_PX,
      HIT_MAX_PX,
    );
    const requests: LabelRequest[] = shown.map(({ city, point }) => {
      const pinned = pins.has(city.id);
      return {
        id: city.id,
        x: point.x,
        y: point.y,
        text: city.name,
        pinned,
        dotOnly: !pinned && city.labelRank > maxRank,
        preferred:
          pinned && route && !stopsMode && origin && destination
            ? routeLabelSides(point, screen.get(city.id === origin.id ? destination.id : origin.id))
            : undefined,
      };
    });
    const edge = 4;
    const free = this.freeSpan();
    const labels = layoutLabels(requests, {
      fontSize: LABEL_PX,
      dotRadius: DOT_PX + 2,
      bounds: {
        left: Math.max(edge, free.left + edge),
        top: edge,
        right: Math.min(width - edge, free.right - edge),
        bottom: height - edge,
      },
      reserved: interactive ? this.controlZones(width, height) : [],
    });

    return shown.map(({ city, point }, index) => {
      const pin = pins.get(city.id) ?? '';
      const role = this.roleOf(city.id, stopsMode, routeCities);
      return {
        city,
        point,
        role,
        pin,
        label: labels.get(city.id) ?? null,
        ariaLabel: !role
          ? city.name
          : stopsMode
            ? `${city.name}, stop ${pin}`
            : `${city.name}, ${role}`,
        dimmed: route !== null && role === null,
        hitRadius: hitRadius[index],
      };
    });
  });

  /** Where the zoom buttons and the hint cover the drawing, so no label is placed there. */
  private controlZones(width: number, height: number): Box[] {
    const zones =
      this.controls() === 'corner' ? this.cornerZones(width, height) : this.endZones(width, height);
    const top = this.topZone();
    if (top) {
      const left = top.align === 'center' ? (width - top.width) / 2 : 0;
      zones.push({ left, top: 0, right: left + top.width, bottom: top.height });
    }
    return zones;
  }

  private cornerZones(width: number, height: number): Box[] {
    return [
      { left: width - ZOOM_ZONE_WIDTH_PX, top: 0, right: width, bottom: ZOOM_ZONE_HEIGHT_PX },
      { left: 0, top: height - 30, right: 240, bottom: height },
    ];
  }

  private endZones(width: number, height: number): Box[] {
    const end = width - this.insetEnd();
    const middle = this.insetStart() + (width - this.insetStart() - this.insetEnd()) / 2;
    return [
      {
        left: end - ZOOM_ZONE_WIDTH_PX,
        top: height - ZOOM_ZONE_HEIGHT_PX,
        right: end,
        bottom: height,
      },
      { left: middle - 120, top: height - 30, right: middle + 120, bottom: height },
    ];
  }

  /** The one city that can be reached with Tab: the last one focused, else the origin, else the first. */
  protected readonly tabStopId = computed(() => {
    const markers = this.markers();
    const last = this.lastFocusedId();
    if (last !== null && markers.some((marker) => marker.city.id === last)) {
      return last;
    }
    const start =
      markers.find((marker) => marker.role === 'origin') ??
      markers.find((marker) => marker.role !== null) ??
      markers[0];
    return start?.city.id ?? null;
  });

  /** Details for the city under the pointer or keyboard focus, positioned over the map. */
  protected readonly card = computed(() => {
    const city = this.cityById(this.hoveredId());
    const point = city ? this.points().get(city.id) : undefined;
    if (!city || !point || !this.interactive()) {
      return null;
    }
    const origin = this.cityById(this.originId());
    const left = (point.x / this.renderedWidth()) * 100;
    const top = (point.y / this.renderedHeight()) * 100;
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
  /** Where the running animation ends, so a quick second click builds on it. */
  private animationTarget: GlobeView | null = null;
  private scrollHintTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pressStart: { x: number; y: number } | null = null;
  private dragged = false;
  private pinchDistance = 0;
  private lastRouteKey: string | null = null;
  /** True once the user has turned or zoomed the globe by hand since the last route. */
  private adjusted = false;

  constructor() {
    afterNextRender(() => this.observeSize());
    this.destroyRef.onDestroy(() => {
      this.stopAnimation();
      clearTimeout(this.scrollHintTimer);
    });
    this.watchReducedMotion();
    this.loadLand().then(
      ({ LAND_RINGS }) => {
        this.landShapes.set(landGeometry(LAND_RINGS));
        this.landState.set('ready');
      },
      () => this.landState.set('failed'),
    );

    // Turn to a newly chosen route (smoothly), and back to Europe when it is cleared. When only the
    // size of the map or the space the panels leave changes (a layout switch, a resize), a view the
    // user has moved is kept (same centre, same zoom) and otherwise the route is fitted again,
    // without animation.
    effect(() => {
      const key = this.routeKey();
      const home = this.homeView();
      const interactive = this.interactive();
      untracked(() => {
        const routeChanged = key !== this.lastRouteKey;
        const first = this.lastRouteKey === null;
        this.lastRouteKey = key;
        if (routeChanged) {
          this.adjusted = false;
        } else if (this.adjusted) {
          return;
        }
        this.moveTo(home, routeChanged && !first && interactive);
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
    this.dragged = false; // a key press is never the end of a drag
    this.pick(city);
  }

  // --- Zoom buttons and keys ------------------------------------------------------

  protected zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  protected zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  private zoomBy(factor: number, keepCityId: number | null = null): void {
    this.adjusted = true;
    const view = this.animationTarget ?? this.view();
    const target = { ...view, zoom: clampZoom(view.zoom * factor) };
    const city = this.cityById(keepCityId);
    if (city) {
      // A focused city must stay on screen (it would lose focus if it left the drawing), so the
      // view turns to it when the new zoom would push it out. Applied at once: no frame without it.
      this.moveTo(this.keepInView(target, city), false);
      return;
    }
    this.moveTo(target, true);
  }

  private keepInView(target: GlobeView, city: City): GlobeView {
    const projected = createGlobeProjection(
      target,
      this.geometry(),
    )([city.longitude, city.latitude]);
    const free = this.freeSpan();
    const margin = FIT_MARGIN_PX / 2;
    const inside =
      isVisible(city, target) &&
      projected !== null &&
      projected[0] >= free.left + margin &&
      projected[0] <= free.right - margin &&
      projected[1] >= margin &&
      projected[1] <= this.renderedHeight() - margin;
    return inside ? target : { ...target, longitude: city.longitude, latitude: city.latitude };
  }

  /** Goes back to the route, or to Europe when there is none. */
  protected reset(): void {
    this.adjusted = false;
    this.moveTo(this.homeView(), true);
  }

  protected onMapKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return; // browser shortcuts such as Ctrl+minus
    }
    const turn = ARROWS[event.key];
    if (event.key === '+' || event.key === '=') {
      this.zoomBy(ZOOM_STEP, this.focusedCityId());
    } else if (event.key === '-' || event.key === '_') {
      this.zoomBy(1 / ZOOM_STEP, this.focusedCityId());
    } else if (event.key === '0') {
      // The focused city may not exist after the reset: focus moves to the map first.
      this.svg()?.nativeElement.focus();
      this.reset();
    } else if (turn) {
      this.adjusted = true;
      const step = KEY_ROTATE_DEGREES / this.view().zoom;
      this.moveTo(rotateByDegrees(this.view(), turn.x * step, -turn.y * step), false);
    } else {
      return;
    }
    event.preventDefault();
  }

  /** Arrow keys on a city move focus to the nearest city in that direction; with none there, they rotate. */
  protected onCityArrow(event: KeyboardEvent, city: City): void {
    const direction = ARROWS[event.key];
    if (!direction || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const next = nearestInDirection(city, direction, this.cities(), this.points());
    if (next) {
      event.preventDefault();
      event.stopPropagation();
      this.focusCity(next.id);
    }
  }

  // --- Pointer: wheel, drag, pinch -----------------------------------------------

  protected onWheel(event: WheelEvent): void {
    if (!this.interactive()) {
      return;
    }
    const modifier = event.ctrlKey || event.metaKey; // also how a trackpad pinch arrives
    if (this.cooperative() && !modifier) {
      this.showScrollHint(); // the page scrolls
      return;
    }
    const factor = Math.exp(-event.deltaY * 0.0018);
    const zoom = this.view().zoom;
    const atLimit = factor > 1 ? zoom >= MAX_ZOOM : zoom <= MIN_ZOOM;
    if (atLimit && !modifier) {
      return; // nothing left to zoom: never trap the page's scrolling
    }
    event.preventDefault(); // zoom the globe instead of scrolling the page
    this.setZoom(factor);
  }

  private showScrollHint(): void {
    this.scrollHint.set(true);
    clearTimeout(this.scrollHintTimer);
    this.scrollHintTimer = setTimeout(() => this.scrollHint.set(false), SCROLL_HINT_MS);
  }

  /** Escape closes the hover/focus card (without moving the pointer or focus). */
  protected dismissCard(): void {
    if (this.hoveredId() !== null) {
      this.hoveredId.set(null);
    }
  }

  protected onCityFocus(id: number): void {
    this.lastFocusedId.set(id);
    this.hoveredId.set(id);
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
        this.setZoom(spread / this.pinchDistance);
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
    this.view.set(
      rotateBy(this.view(), event.clientX - previous.x, event.clientY - previous.y, this.disc().r),
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

  private setZoom(factor: number): void {
    this.stopAnimation();
    this.adjusted = true;
    const view = this.view();
    this.view.set({ ...view, zoom: clampZoom(view.zoom * factor) });
  }

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

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private focusCity(id: number): void {
    this.host.nativeElement.querySelector<SVGGElement>(`g.city[data-id="${id}"]`)?.focus();
    this.hoveredId.set(id);
  }

  /** The city that has keyboard focus right now, if any. */
  private focusedCityId(): number | null {
    const focused = this.host.nativeElement.querySelector<SVGGElement>('g.city:focus');
    return focused ? Number(focused.getAttribute('data-id')) : null;
  }

  /** Shows `target`, turning there over {@link ANIMATION_MS} (one signal write per frame) unless `animate` is off. */
  private moveTo(target: GlobeView, animate: boolean): void {
    this.stopAnimation();
    if (!animate || this.reducedMotion() || typeof requestAnimationFrame === 'undefined') {
      this.view.set(target);
      return;
    }
    this.animationTarget = target;
    const from = this.view();
    let started: number | null = null;
    const step = (now: number) => {
      started ??= now; // the first frame is the start, whatever clock the timestamps use
      const t = Math.min(1, Math.max(0, (now - started) / ANIMATION_MS));
      const eased = 1 - Math.pow(1 - t, 3);
      this.view.set(t < 1 ? interpolateView(from, target, eased) : target);
      if (t < 1) {
        this.animationFrame = requestAnimationFrame(step);
      } else {
        this.animationTarget = null;
      }
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private stopAnimation(): void {
    this.animationTarget = null;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  private watchReducedMotion(): void {
    const media = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) {
      return;
    }
    this.reducedMotion.set(media.matches);
    const update = (event: MediaQueryListEvent) => this.reducedMotion.set(event.matches);
    media.addEventListener?.('change', update);
    this.destroyRef.onDestroy(() => media.removeEventListener?.('change', update));
  }

  private observeSize(): void {
    const element = this.svg()?.nativeElement;
    if (!element) {
      return;
    }
    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        this.renderedWidth.set(width);
        this.renderedHeight.set(height);
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

const GRATICULE = geoGraticule().step([30, 30])();

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
function routeLabelSides(point: MapPoint, other: MapPoint | undefined): LabelSide[] | undefined {
  if (!other) {
    return undefined;
  }
  const dx = other.x - point.x;
  const dy = other.y - point.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0 ? ['top', 'left', 'right'] : ['bottom', 'right', 'left'];
  }
  return dx > 0 ? ['left', 'top', 'bottom'] : ['right', 'top', 'bottom'];
}

/** The land rings (flat [longitude, latitude, ...]) as one GeoJSON multi-polygon. */
function landGeometry(rings: readonly (readonly number[])[]): GeoPermissibleObjects {
  return {
    type: 'MultiPolygon',
    coordinates: rings.map((ring) => {
      const points: number[][] = [];
      for (let i = 0; i < ring.length; i += 2) {
        points.push([ring[i], ring[i + 1]]);
      }
      points.push(points[0]);
      return [points];
    }),
  };
}
