# RouteWise UI (frontend)

Angular 22 single-page app, TypeScript, SCSS, npm. Read the root `CLAUDE.md`
first; this file adds frontend-specific rules.

## Layout

```
src/
├── environments/        build-time settings (API base URL)
├── styles.scss          design tokens (CSS variables), base styles, shared classes
└── app/
    ├── core/
    │   ├── api/         typed API layer: models, one service per resource, ApiError
    │   ├── auth/        Session (who is logged in), authGuard, credentialsInterceptor
    │   └── theme/       ThemeService (light, dark or system preference, `data-theme` on `<html>`)
    ├── layout/          app chrome: header (full width, same 24 px gutter as the Home panels; 16 px on phones;
    │                    strict 3-column grid `1fr auto 1fr`: brand, centred nav pill, actions incl. the theme menu)
    ├── shared/ui/       presentational building blocks: glass panel, pill nav, stat chip, tabs,
    │                    segmented toggle, filter chip, filter group, menu, toast outlet, icon button, bottom sheet, spinner,
    │                    error message, confirm action, pickers, mode icon
    ├── shared/map/      interactive globe map (SVG, `d3-geo`) and its pure maths (`globe.ts`)
    ├── shared/util/     pure helpers (dates, labels, `LayoutBreakpoint`)
    ├── features/<name>/ routed pages and their child components
    ├── app.ts           shell: skip link, header, <router-outlet>, footer
    ├── app.routes.ts    lazy routes (`loadComponent`)
    └── app.config.ts    providers: router, HttpClient + interceptors, session load at start-up
```

## Commands

| Task              | Command                                                     |
| ----------------- | ----------------------------------------------------------- |
| Dev server        | `npm start` (http://localhost:4200, needs the API on :8087) |
| Tests, single run | `npm test` (`npm run test:watch` to watch)                  |
| Lint              | `npm run lint`                                              |
| Format            | `npm run format` (`npm run format:check` to verify)         |
| Production build  | `npm run build`                                             |

## Conventions

- **Components:** standalone, `ChangeDetectionStrategy.OnPush`, signals for
  state, `inject()` for DI, `input()`/`output()` functions, built-in control
  flow (`@if`, `@for`). The app is zoneless. Selector prefix `app-`; class
  names without a `Component` suffix (`HomePage`, `Header`).
- **Smart/presentational split:** pages in `features/` load data through API
  services; components in `shared/ui/` only take inputs and emit outputs.
- **HTTP:** only through the services in `core/api/` (`TripApi`, `CityApi`,
  `TransportModeApi`, `ComparisonApi`, `AdvisorApi`, `AuthApi`); components never use `HttpClient`.
  URLs are built from the `API_BASE_URL` token. `models.ts` mirrors the
  backend DTO records: change both sides together.
- **Errors:** `apiErrorInterceptor` turns every failed call into an `ApiError`
  (from the backend's Problem Details; `status` 0 = API unreachable, with
  `fieldErrors` for validation failures). Show it with `<app-error-message>`.
- **Auth:** the API keeps a session cookie. `credentialsInterceptor` sends
  cookies to the API and echoes the `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` on
  changing requests (Angular's built-in XSRF support skips absolute URLs).
  It sits inside `apiErrorInterceptor` so it sees the raw 401, which ends the
  UI session and opens `/login?returnUrl=…`. Pages and the header read the
  user from `Session`; log in/out only through `Session`, never `AuthApi`
  directly. Routes that need a login get `canActivate: [authGuard]`; the
  session is loaded once by an app initializer before the first navigation.
  After login, go to `safeReturnUrl(returnUrl)` (paths inside the app only).
- **Routing:** lazy `loadComponent` routes; route parameters arrive as
  component inputs (`withComponentInputBinding`), e.g. `id = input.required<string>()`.
- **Forms:** reactive, typed (`NonNullableFormBuilder`), in a presentational
  form component that emits the request; the page saves it. Native controls
  (`<input type="date">`, radio buttons) where they fit; cities are chosen with
  `CityPicker` (pass `id`, `invalid` and `describedBy` so errors are announced).
  A trip's stops are a `FormArray` of city ids (2–10, `MIN_STOPS`/`MAX_STOPS` in
  `models.ts`) with add, remove and move up/down; API errors such as
  `stops[1].cityId` are shown on that stop. Each field has a label, shows its error
  once touched (`aria-invalid` + `aria-describedby`), and client rules mirror
  the API's. API field errors come back through `ApiError.fieldErrors` and are
  shown on the matching field (see `TripForm` / `TripFormPage`).
  Every `<form>` needs `[formGroup]`: without it `(ngSubmit)` never fires and
  the browser submits natively (page reload).
- **Dependent data:** a resource that needs another's result takes it as
  `params` (e.g. comparison and advice wait for the trip), so a missing trip
  produces one error, not three. Each section shows its own loading and error state.
- **Map and charts:** `RouteMap` is an interactive orthographic globe drawn as SVG with `d3-geo` (the only
  map dependency: projection, horizon clipping, great-circle interpolation; no 3D, zoom or drag library).
  Pure maths lives in `globe.ts` (projection, `isVisible`, `maxLabelRank`, `rotateBy`, `fitRoute`,
  `interpolateView`, `greatCircle`) and is unit-tested. The view is `{ longitude, latitude, zoom }` (centre of
  the disc and 1-8x the globe fitted into the free space) in one signal; drag (pointer capture, touch too),
  wheel, pinch, the +/- buttons and keys change it, and every change re-projects land, graticule, route and
  cities from that signal (no layout reads while turning; drag, wheel and pinch apply at once, the buttons,
  Reset and a new route animate). The drawing is in CSS pixels (no `viewBox`). Land and country borders come from
  `world-land.ts` (Natural Earth 1:110m, generated by `scripts/gen-world-land.py`; regenerate, do not edit),
  loaded with a dynamic `import()` so it is its own chunk; the globe shows the sea until it arrives.
  Initial view: centred on the selected route (fitted into the space left by the floating panels, see
  `insetStart`/`insetEnd`), otherwise Europe (lon 10, lat 50). A new route turns the globe there with a
  `requestAnimationFrame` animation along the great circle (instant under `prefers-reduced-motion`);
  a view the user moved is kept when the map resizes or a layout switch changes the space; "Reset view" (and
  `0`) goes back to the route or Europe. Keyboard: arrows rotate the globe (or move focus to the nearest
  city when a city has focus), `+`/`-` zoom, `0` resets. Routes are great-circle arcs, one `<path>` per
  leg, cut at the horizon by the projection. Cities on the far side are not rendered at all (so not
  focusable); the rest are labelled buttons. Labels are placed by `layoutLabels` (no overlaps) in order of
  `labelRank` (then capital, then name) and only up to `maxLabelRank(zoom)` (rank 1 always, 2 from 2x, 3
  from 4x); the selected route's cities are always labelled and a city without a label keeps its
  `aria-label`. It is presentational and emits the selection (origin/destination), or, with `[stops]`
  (an ordered list of city ids), draws every leg with numbered pins and emits `cityPick` instead. With
  `[wide]="true"` a map at least 720 px wide takes a 16:9 shape instead of the near-square one. `[fill]` makes
  the map take its container's size and centres the globe between the panels. `controls` (`corner` |
  `bottom-end`) places the zoom buttons (`bottom-end`: bottom right, `insetEnd` px in from the edge, clear of
  the panels). A non-interactive map (trip details) is an image of the route cities only. `ComparisonChart` shows one metric at a time (switched with `Tabs`) with the
  recommended mode as the only accent bar (`--color-highlight`, others
  `--color-bar`). Neither may be the only way to get information: keep a
  text or form equivalent (dropdowns for the map, the table for the chart)
  and state selection in text and `aria-pressed`, not color alone.
  Map details: one city is the tab stop (roving `tabindex`: last focused, else origin, else first; arrows move
  between cities); click targets are capped at half the distance to the nearest neighbour; low-ranked cities
  within 2.5 dot widths of a more important one are left out (still in the pickers); in `fill` mode only the
  space between the docks is drawn and labelled, and `topZone` reserves the layout toolbar for labels.
  `gestures`: `greedy` (default; the wheel always zooms except at the zoom limits) or `cooperative` for a map in a
  scrolling page (Ctrl/Cmd + wheel zooms, a plain wheel scrolls and shows "Ctrl + scroll to zoom", `touch-action:
  pan-y`). The land chunk loads through the `LAND_LOADER` token (override it in tests); failure shows a note.
  Unavailable modes are shown muted with a ⊘ icon: each row says only "Not available", and the API's grouped
  sentences (`unavailableGroups` on each leg and on the comparison, e.g. "Not reachable by land between Dublin
  and Madrid: train, bus, car, bike") are shown once per leg (chart, itinerary timeline) and once for the
  whole-trip totals. Never word reasons in the UI.
  Mode icons (`ModeIcon`) are decorative and always sit next to the name.
- **City choice:** `CityPicker` (ARIA combobox) next to every interactive map;
  priorities with `PriorityPicker`.
- **Comparisons are per leg:** the API returns `legs`, `recommendedItinerary`
  and `singleModeTotals`. `ComparisonChart`, `ComparisonPanel` and
  `comparisonInsight` work on one leg (`LegComparison`, built with
  `legComparison(comparison, index)`). A two-stop trip and the home explorer
  show that single leg as before; a multi-stop trip uses `ItineraryView`
  (leg timeline, whole-trip totals, each leg's details).
- **Home layouts** (`features/explore/`): two layouts, **Map** and **Split**. `HomeLayout` (`home-layout.ts`)
  holds the preference (`'map' | 'split'`, default Split, `localStorage` key `routewise.homeLayout`, every
  access in try/catch, invalid or failing storage = Split) and `effective()`: Map only while the viewport is
  at least 1440 px (live `matchMedia`), otherwise Split; falling back never overwrites the saved choice.
  `sideBySide()` is true from 1024 px. A `SegmentedToggle` (icon + label, `stage__toolbar`, floating over the
  map) offers the choice only from 1440 px. `RouteExplorer` renders **one template once**: the map, the
  settings dock and the results dock are the same elements in both layouts and `explorer-stage.scss` only moves
  them (class `stage--map` / `stage--split` / `stage--sheet`), so switching keeps cities, priority, date,
  travelers, results and the map view and issues no request. Never put the form or results in two `@if`
  branches. Split: map 58 % at the left, the right column (`stage__side`, focusable scroll region from 1024 px)
  holds settings and results; stacked below 1024 px. Map: map fills the stage, two floating `GlassPanel` docks
  (collapsible, 24rem; the settings fit 1440x900 without scrolling: short intro, 2x2 priorities without
  descriptions, compact spacing); the empty results dock is a hint chip ("Pick two cities to compare") until a
  comparison is requested. Phones (< 768 px, `LayoutBreakpoint` `narrow`): map plus `BottomSheet` with settings
  and results. Docks adapt through container queries (route bar, `ComparisonPanel` turns its table into small
  cards below 30rem instead of scrolling sideways). `--header-height` is the measured header height (the stage is
  `100dvh - header`).
- **Trips list** (`features/trips/list/`): `TripToolbar` (row 1: search, Board/List
  `SegmentedToggle`, New trip; row 2: `FilterGroup`s Priority and Mode with the API's facet counts;
  result count "3 of 5 trips" in a `role="status"` and "Clear filters"; below 768 px the groups move
  into a `BottomSheet` opened by a "Filters" button), `TripBoard` (columns by priority), `TripTable`,
  `TripCard`, `TripMenu` (built on `Menu`). The API does the work: `GET /api/trips` (`TripApi.search`) searches,
  filters, sorts and returns each trip's `figures` (computed without weather), the chip counts (`facets`) and the
  board column totals (`priorityTotals`); `GET /api/trips/stats` the KPIs. The page keeps only the query
  (search debounced 300 ms, chips, the table's sort, which applies only in the list view; `PAGE_SIZE` 100, no
  paging controls yet) and keeps the previous page visible while the next loads (`linkedSignal`).
  `trip-figures.ts` maps the page to entries (`tripEntries`) and board columns (`boardColumns`) and holds the
  wording helpers (`modeSummary`, `tintFor`); `trip-filters.ts` builds the query (`tripSearch`), reads the
  facets and keeps `toggleSort`/`resultSummary`. No business maths in the UI.
  Cards and rows open the trip as a whole: the title link carries an `::after` stretched over the card/row
  (one tab stop; the focus ring is drawn on the card via `:has(a:focus-visible)`), the "⋯" menu and
  `TripActions` (quick icon buttons Open, Edit, Duplicate, Delete) sit above it with a higher z-index. Quick
  actions show on hover and on focus within, never under `(hover: none)`; Delete swaps them for the inline
  `ConfirmAction` (`asking`, `showTrigger`). Hover/focus lifts the card 2 px with an edge in its tint
  (`--color-highlight-edge`, `--color-accent-edge`) and no motion under reduced motion. `TripRoute` is the
  decorative (`aria-hidden`) mini route line: a dot per stop, the leg's mode icon between them (`legModes`).
  The CO₂ bar shows the plan against the car (car = 100 %, from `co2ShareOfCar`/`co2VsCarPercent`) with text.
  `TripTable` shows the rows in API order; its Date, Cost and CO₂ header buttons (`aria-sort` on the `<th>`)
  change the page's sort, which goes to the API.
  **Delete** is a soft delete: after the confirmed DELETE an info toast "Deleted …" offers Undo
  (`TripApi.restore`, possible for 30 s), then list and stats reload.
  **Duplicate** is a link to `/trips/new` with router navigation state `{ draft }` (`duplicateState`);
  `TripFormPage` reads it once (`presetFromState`: invalid fields dropped, ignored when editing) and the
  user still saves.
- **Changing a trip's priority** (Trips page): `TripListPage.move` builds the existing update request from the
  trip in the list (`moveRequest`, `list/trip-move.ts`: all fields, stops as city ids, date unchanged) and calls
  `TripApi.update`. It is optimistic (`withPriority` in place, so the order is kept; `aria-busy` on the card/row
  while pending), merges the response into the item and reloads the list and stats (the priority weights
  the recommendation), and on failure restores the priority and shows an error `ToastService` toast with Retry.
  Two ways in: the "Move to …" items of `TripMenu` (keyboard, touch) and dragging on `TripBoard`, which is
  hand-written with pointer events (no CDK): a mouse/pen drag starts after `DRAG_THRESHOLD_PX`, a finger after a
  `LONG_PRESS_MS` press (moving earlier means scrolling); `board-drag.ts` holds the pure hit test (`columnAt`
  over the columns' rects). The ghost is a clone of the card on `<body>`; the original stays as a dashed
  placeholder, the column under the pointer gets `column--target`; Escape or a drop outside cancels, a drop on
  the own column is ignored, and the click after a drag is swallowed. A polite live region on the page announces
  "Moved "<title>" to …".
- **Menu, filter group, toast** (`shared/ui/`): `Menu` is a disclosure (built-in `IconButton` trigger via
  `label` + `menuIcon`, or your own `menuTrigger` button; panel content in `<ng-template appMenuContent>`,
  rendered only while open; Escape and outside click close, an item click closes unless
  `closeOnSelect` is off; arrow keys move between items). `FilterGroup` is a `role="group"` of
  `aria-pressed` chips with `options`, a `selected` model and an optional `appFilterIcon` template.
  `ToastService.show({ message, kind, action? })` plus one `<app-toast-outlet>` in `app.ts`
  (auto-dismiss after 5 s, paused on hover and focus; errors in `role="alert"`, info in `role="status"`).
- **Explorer state** is mirrored in the URL (`from`, `to`, `date`, `travelers`,
  `priority`; defaults left out).
- **Query parameters** also arrive as component inputs; `/trips/new` accepts
  `from`, `to`, `date`, `travelers`, `priority` and ignores invalid values.
- **Destructive actions:** `<app-confirm-action>` (inline two-step confirm),
  never a one-click delete.
- **Async views:** load with `rxResource` and render all states: loading
  (`<app-spinner>`, `role="status"`), error with retry (`<app-error-message>`, `role="alert"`), empty
  (`.empty-state`: centered glass panel with heading, hint and action) and data.
- **Styling:** no UI library. Use the tokens in `styles.scss` (`var(--color-…)`,
  `var(--space-…)`), never raw colors. Palette is a strict 60/30/10: midnight
  black backgrounds (`--color-bg`, `--color-surface`), pure white text and lines
  (`--color-text`, borders), and lime `--color-primary` as the **only** accent.
  Use lime only for primary buttons, links, active/selected states
  (`--color-primary-soft` backgrounds), focus, the map route and the
  recommended mode (`--color-highlight*`, which map to lime). Everything else
  stays black/white/gray (`--color-bar` for de-emphasised marks). Red
  (`--color-danger`) and amber (`--color-accent`, weather) are semantic only.
  `--color-border-strong` for control borders. Every text pair meets 4.5:1 and
  every meaningful mark 3:1; check a new or changed pair before using it.
  Glass look: a fixed `.glow-layer` element in `app.ts` (`aria-hidden`, three
  large lime radial glows at 16/12/12% centre alpha, `--glow-1..3`, drifting
  over 26-38 s with `transform` only, static under reduced motion) sits behind
  all content, so no ancestor of a glass surface may have an opaque background.
  Glass = `background: var(--glass-bg)` (white 6%) or `--glass-bg-strong` (white
  10%, controls and active items) or `--glass-bg-menu` (surface 85%, dropdowns and
  listboxes over arbitrary content), plus `backdrop-filter: var(--glass-filter)`
  (+ `-webkit-`; blur 20 px and saturate 160%), `border: 1px solid var(--glass-border)`
  and `box-shadow: var(--glass-highlight)` (inner top highlight; combine it with
  any other shadow). Alpha variants are written as `--color-*-aNN` (NN = percent;
  same hues, add one only when used). `backdrop-filter` goes on the few top-level
  surfaces (header bar via `:host::before` so dropdowns are not inside its
  backdrop root, panels, sheet, menus, toolbar search, chips); never on list
  cards or table rows (fill, border and highlight only), and not on elements
  nested in a glass panel (a backdrop-filter ancestor limits what they can blur).
  Contrast rule: white, muted and lime text must stay 4.5:1 and control borders
  3:1 on the fill over the brightest glow (peak 16% lime over `--color-bg`);
  re-run the check when raising a glow, a fill or a tint (card tints are 8%).
  Under `prefers-reduced-transparency` the glass tokens become solid surfaces
  with `--glass-filter: none`, so never hard-code a blur or a translucent fill.
  The light theme overrides the tokens under `:root[data-theme='light']` (see Theme). Radii: `--radius-lg`
  (cards), `--radius-md`, `--radius-pill` (buttons, inputs, badges). Type: 17 px body, Manrope (loaded in
  `index.html`, weights 400-800) is the only font (`--font-sans`; `--font-display`
  is an alias). Shared classes: `.card`, `.button` (`--primary`,
  `--danger`), `.page-header`, `.actions`, `.badge` (`--recommended`),
  `.empty-state`, `.segmented` (radio group as buttons), `.field` (`__hint`, `__error`),
  `.muted`, `.visually-hidden`. Building blocks in `shared/ui/`: `GlassPanel` (`headingLevel` 1-3 renders
  the matching `<h1>`-`<h3>`; optional collapse), `PillNav`, `StatChip`, `Tabs` (ARIA tabs, e.g. the
  metric switch), `SegmentedToggle`, `FilterChip`, `IconButton`, `BottomSheet`; prefer them over new
  one-off controls. Blur only on a few top-level panels, never per list row. Component styles stay
  small (4 kB budget).
- **Theme:** light, dark and system. `ThemeService` (`core/theme/theme.ts`) holds the
  preference (`'light' | 'dark' | 'system'`, default system, saved in `localStorage` key
  `routewise.theme`; every storage access is in try/catch and falls back to system), follows
  `prefers-color-scheme` live while on system, and sets `data-theme` and `color-scheme` on
  `<html>`. An inline script in `index.html` does the same before first paint (keep the key and
  values in sync with the service). The header's theme menu (disclosure with three `aria-pressed`
  buttons, current one also marked with a ✓) changes it. Dark tokens live in `:root`; light tokens
  redefine them from the same palette (midnight black as ink, white and ink alphas as surfaces).
  **Lime is a fill only in light mode** (primary buttons, badges, selected tints, glows, the map
  route over a dark halo): anything that is lime text, a link, a thin line, a stroke or the focus
  ring uses `--color-primary-ink` (lime in dark, ink in light), selected backgrounds use
  `--color-selected-bg`, recommended stripes, bar outlines and primary-button borders use
  `--color-highlight-edge`, and red/amber text uses `--color-danger-text`/`--color-accent-text`
  (red and amber are borders and fills with ink text in light). Never write `color: var(--color-primary)`.
  Map tokens (`--map-sea`, `--map-land`, `--map-border`, `--map-city`) have light variants and
  `--map-route-halo` is the outline under the route and pins. Use only tokens in components so both
  themes work; check any new pair in light and dark. `prefers-reduced-transparency` makes the glass
  solid in both themes.
- **Accessibility:** semantic HTML and landmarks, labels on inputs, visible
  focus, nothing conveyed by color alone, scrollable regions focusable.
  Layouts work down to 375 px.
- **Formatting:** Prettier (a Claude Code hook formats edited files); ESLint
  with angular-eslint including the template accessibility rules.
- Ask before adding a dependency (root rule).

## Testing

- Vitest through `ng test`, with `TestBed`; specs sit next to the code (`*.spec.ts`).
- API services: `provideHttpClientTesting()` + `HttpTestingController`, with
  `API_BASE_URL` overridden; call `verify()` in `afterEach`.
- Components: assert on rendered DOM and roles (`role="status"`, `role="alert"`),
  not on internals. Cover loading, data, empty and error states.
- Zoneless timing: `await fixture.whenStable()` after flushing a response. Do
  not await it while a request you have not flushed is pending (it never
  resolves); use `TestBed.tick()` to start the request instead.
- Dependent resources start a microtask after their parameter arrives: tick
  and await a few times before expecting their requests (see `loadTrip` in
  `trip-details-page.spec.ts`).
- Forms: drive them through the DOM with the helpers in
  `features/trips/trip-form.testing.ts` (`typeInto`, `choose`, `submit`).
- Never call the real API in tests.
- Restart `npm start` after switching git branches: the dev server does not
  recover when the project files disappear during a checkout.
