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
    │   └── auth/        Session (who is logged in), authGuard, credentialsInterceptor
    ├── layout/          app chrome (`header/`: the header, `AccountPanel`; `command-palette/`, `upcoming-trips/`,
    │                    `shortcuts/`: the rail's global tools): the header inside the shell (strict 3-column grid `1fr auto 1fr`: logo tile
    │                    plus, on Home from 1440 px, the Map/Split toggle | centred pill nav Home, Trips, Modes |
    │                    round search and new-trip buttons, account menu; 24 px gutter, 16 px on phones)
    ├── shared/ui/       presentational building blocks: app shell, icon rail, glass panel, pill nav, stat chip, tabs,
    │                    segmented toggle, filter chip, filter group, menu (also the popover), toast outlet, icon button, bottom sheet,
    │                    spinner, error message, dialog, modal, pagination, pickers, mode icon
    ├── shared/map/      interactive globe map (SVG, `d3-geo`) and its pure maths (`globe.ts`)
    ├── shared/util/     pure helpers (dates, labels, `LayoutBreakpoint`)
    ├── features/<name>/ routed pages and their child components
    ├── app.ts           root: backdrop, skip link, `AppShell` (header, icon rail from 1024 px, scrolling page area
    │                    with <router-outlet> and footer)
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
  `interpolateView`, and the lifted arcs: `arcPeak`, `projectLifted`, `arcSamples`, `arcPrefix`, `arcSegments`) and is unit-tested. The view is `{ longitude, latitude, zoom }` (centre of
  the disc and 1-8x the globe fitted into the free space) in one signal; drag (pointer capture, touch too),
  wheel, pinch, the +/- buttons and keys change it, and every change re-projects land, graticule, route and
  cities from that signal (no layout reads while turning; drag, wheel and pinch apply at once, the buttons,
  Reset and a new route animate). The drawing is in CSS pixels (no `viewBox`). Land and country borders come from
  `world-land.ts` (Natural Earth 1:110m, generated by `scripts/gen-world-land.py`; regenerate, do not edit),
  loaded with a dynamic `import()` so it is its own chunk; the globe shows the sea until it arrives.
  **Glass globe:** a translucent sphere drawn in layers (`circle.glass-halo`, `circle.sea`, graticule, `path.land`,
  `circle.glass-air` inner lime glow, `circle.glass-sheen` white highlight at the upper left, `circle.glass-rim`); the
  two gradients are defined per map (`gradientId`, so several maps on a page do not share ids). Map tokens in
  `styles.scss`: `--map-sea` (`--color-bg-a60`, so the backdrop glows show through), `--map-land` (white 10%,
  lighter than the ocean), `--map-coast` (white 35%, 0.5 px), `--map-graticule` (white 6%), `--map-sheen`, `--map-rim`
  (lime 35%), `--map-air`, `--map-halo`, `--map-city` (white 60%, dots 3.5 px), `--map-label` (muted),
  `--map-label-halo`, `--map-route-glow`, `--map-route-halo` (pin outline). Under `prefers-reduced-transparency`
  `--map-sea` and `--map-land` become opaque (`#10141b`, `#222936`). Contrast at the brightest backdrop point and
  the lightest globe layer (land plus the highlight): muted labels 6.6:1, lime labels and route 6.2:1, dots
  4.2:1, route over its glow 4.0:1; on the ocean 9:1 and better. Re-check with a small script when a map token changes.
  Initial view: centred on the selected route (fitted into the space left by the floating panels, see
  `insetStart`/`insetEnd`), otherwise Europe (lon 10, lat 50). A new route turns the globe there with a
  `requestAnimationFrame` animation along the great circle (instant under `prefers-reduced-motion`);
  a view the user moved is kept when the map resizes or a layout switch changes the space; "Reset view" (and
  `0`) goes back to the route or Europe. Keyboard: arrows rotate the globe (or move focus to the nearest
  city when a city has focus), `+`/`-` zoom, `0` resets. **Routes are lifted arcs:** each leg still follows the
  great-circle path (so it matches the calculated distance) but is drawn above the surface, `h` = clamp(0.5 x the
  leg's angle in radians, 0.02, 0.3) of the globe radius at the peak (Berlin to Vienna 0.041, anything over
  0.6 rad 0.3), with a parabolic profile `4t(1-t)` (0 at both pins). `projectLifted` puts a point `1 + h` times
  the radius from the middle of the disc and moves it up the screen by `h x z` (`ARC_LIFT_TILT` 1; without that
  an arc in the middle of the disc would not lift at all); it is hidden only when it is on the far side AND
  inside the disc, so an arc just behind the horizon shows against the sky. `arcSamples` samples each leg once
  (at least 48 steps, cached in the route computation); per frame `arcPrefix` keeps the part drawn so far and `arcSegments`
  projects it and cuts it where it goes behind the globe. Pins stay on the
  surface. `fitRoute` includes arc samples in the bounding box, so the apex is in view. The arc draws itself from A to B
  (the `drawn` signal, one `requestAnimationFrame` loop, 350 ms pause, 700 ms per leg, at most 1.8 s; legs in order,
  one arc per leg), re-projected per frame with the view; a new route restarts it (path elements are keyed by
  route and leg). Under `prefers-reduced-motion` (or without `requestAnimationFrame`) the whole arc shows at once.
  The line is lime (`path.route`, 2.5 px) over a wider low-alpha stroke (`path.route--glow`, `--map-route-glow`; no SVG blur
  filter). Once drawn, a dark dash train (`path.route--flow`, CSS `stroke-dashoffset` animation) runs along each
  arc from origin to destination; it is only rendered while motion is not reduced (`reducedMotion` signal,
  plus a `prefers-reduced-motion` rule) and costs no per-frame script work while the globe turns. It runs for as long as the route is shown (an idle
  repaint cost of a few paths) and pauses while the pointer is held down (`.map:active`, i.e. drag and pinch). Cities on the far side are not rendered at all (so not
  focusable); the rest are labelled buttons. Labels are placed by `layoutLabels` (no overlaps) in order of
  `labelRank` (then capital, then name) and only up to `maxLabelRank(zoom)` (rank 1 up to 2.5x, 2 from 2.5x, 3
  from 5x) and a label padding of 0.4 font sizes (no two labels closer than 0.8 font sizes); the selected route's cities are always labelled and a city without a label keeps its
  `aria-label`. It is presentational and emits the selection (origin/destination), or, with `[stops]`
  (an ordered list of city ids), draws every leg with numbered pins and emits `cityPick` instead. With
  `[wide]="true"` a map at least 720 px wide takes a 16:9 shape instead of the near-square one. `[fill]` makes
  the map take its container's size and centres the globe between the panels. `controls` (`corner` |
  `bottom-end`) places the zoom buttons (`bottom-end`: bottom right, `insetEnd` px in from the edge, clear of
  the panels). A non-interactive map (trip details) is an image of the route cities only. `ComparisonChart` shows one metric at a time (switched with `Tabs`) with the
  recommended mode as the only accent bar (score bars are the score itself, 100 = full track; time, cost and
  CO₂ bars are relative to the longest) (`--color-highlight`, others
  `--color-bar`). Neither may be the only way to get information: keep a
  text or form equivalent (dropdowns for the map, the table for the chart)
  and state selection in text and `aria-pressed`, not color alone.
  Map details: one city is the tab stop (roving `tabindex`: last focused, else origin, else first; arrows move
  between cities); click targets are capped at half the distance to the nearest neighbour; cities above the
  zoom's label rank are only drawn when `minDotGap(zoom)` away from every drawn city (36 px up to 2.5x, 22 px up
  to 5x, then 2.5 dot widths), so Europe is not a cloud of unlabelled dots at low zoom (they stay in the pickers); in `fill` mode only the
  space between the docks is drawn and labelled.
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
  `sideBySide()` is true from 1024 px. A `SegmentedToggle` (icon + label) offers the choice only from 1440 px,
  only on Home, and lives in the **header next to the logo** (`Header` reads `HomeLayout`; the explorer only reads
  `effective()`). `RouteExplorer` renders **one template once**: the map, the
  settings dock and the results dock are the same elements in both layouts and `explorer-stage.scss` only moves
  them (class `stage--map` / `stage--split` / `stage--sheet`), so switching keeps cities, priority, date,
  travelers, results and the map view and issues no request. Never put the form or results in two `@if`
  branches. Split: map 58 % at the left, the right column (`stage__side`, focusable scroll region from 1024 px)
  holds settings and results; stacked below 1024 px. Map: map fills the stage, two floating `GlassPanel` docks
  (collapsible, 24rem; compact settings, scrolling a little inside the dock at 1440x900: short intro, 2x2 priorities without
  descriptions, compact spacing); the empty results dock is a hint chip ("Pick two cities to compare") until a
  comparison is requested. Phones (< 768 px, `LayoutBreakpoint` `narrow`): map plus `BottomSheet` with settings
  and results. Docks adapt through container queries (route bar, `ComparisonPanel` turns its table into small
  cards below 30rem instead of scrolling sideways). `--header-height` is the measured header height; the stage is `var(--stage-height)` =
  `100dvh - var(--chrome-height) - var(--footer-height) - 2px` (header, the two shell margins, the footer and the shell
  border), so Home does not scroll the page from 1024 px (between 1024 and 1279 px also less the 2 x `--space-8` of
  `#main` padding); below 34 rem the stage keeps its minimum and the page scrolls. The globe leaves 22 px around itself
  (`GLOBE_MARGIN`). At 1440x900 the Map layout's settings scroll inside their dock by about 60 px (the dock keeps its size);
  at 1920x1080 they fit.
- **Home settings panel:** the date input fills the panel width with the quick dates (Tomorrow / This weekend /
  Next week, `aria-pressed` plus a check mark; the active one is explicit state, `activeQuick`: only the clicked one is active
  even if another names the same day, clicking it again deselects it and clears the date (no date: no comparison request,
  no weather card, a "Pick a date" hint, and the date is not written to the URL, so a reload brings the default date), and typing or
  picking a date in the field ends it; a date that arrives from the URL activates none) as one full-width row of three equal segments under it; "Describe
  a trip instead" and "View trips" are two stacked, full-width buttons. In the Map layout the compact spacing
  keeps the settings within about 60 px of fitting at 1440x900 (they scroll inside the dock).
- **Modes page** (`features/modes/`, public, `GET /api/transport-modes` through `TransportModeApi`): `ModeCard`
  per mode (icon, name, average speed, cost per km, CO₂ per km, max distance, API values only; the page text
  says cost and CO₂ are per traveler, car per vehicle) and `ModeChart`: `Tabs` for speed, cost, CO₂ and max
  distance, horizontal bars proportional to the largest shown value (presentation only), and a "Show as table"
  `details` with every parameter as the non-visual equivalent. The DTO has one CO₂ figure per mode (the plane's
  short- and long-haul factors are not in it). Loading, error with retry and empty states. Home no longer shows
  the mode comparison.
- **Trips list** (`features/trips/list/`): `TripToolbar` (row 1: search, Board/List
  `SegmentedToggle`, New trip; row 2: `FilterGroup`s Priority and Mode with the API's facet counts;
  result count "3 of 5 trips" in a `role="status"` and "Clear filters"; below 768 px the groups move
  into a `BottomSheet` opened by a "Filters" button), `TripBoard` (columns by priority), `TripTable`,
  `TripCard`, `TripMenu` (built on `Menu`). The API does the work: `GET /api/trips` (`TripApi.search`) searches,
  filters, sorts and returns each trip's `figures` (computed without weather), the chip counts (`facets`) and the
  board column totals (`priorityTotals`); `GET /api/trips/stats` the KPIs. The page keeps only the query
  (search debounced 300 ms, chips, the table's sort, which applies only in the list view, and the list's page)
  and keeps the previous page visible while the next loads (`linkedSignal`). The board loads up to `PAGE_SIZE`
  (100) trips and has no paging controls; the list pages by `LIST_PAGE_SIZE` (20), see Pagination below.
  `trip-figures.ts` maps the page to entries (`tripEntries`) and board columns (`boardColumns`) and holds the
  wording helpers (`modeSummary`, `tintFor`); `trip-filters.ts` builds the query (`tripSearch`), reads the
  facets and keeps `toggleSort`/`resultSummary`. No business maths in the UI.
  Cards open the trip as a whole: the title link carries an `::after` stretched over the card (one tab stop;
  the focus ring is drawn on the card via `:has(a:focus-visible)`), the "⋯" menu and `TripActions` (quick icon
  buttons Open, Edit, Duplicate, Delete) sit above it with a higher z-index. A list row is different: a click on
  it expands it (see List view) and only the title link opens the trip. Quick actions show on hover and on focus
  within, never under `(hover: none)`; Delete only asks the page to delete (`deleteRequested`). Hover/focus lifts the card 2 px with an edge in its tint
  (`--color-highlight-edge`) and no motion under reduced motion. `TripRoute` is the
  decorative (`aria-hidden`) mini route line: a dot per stop, the leg's mode icon between them (`legModes`).
  The CO₂ bar shows the plan against the car (car = 100 %, from `co2ShareOfCar`/`co2VsCarPercent`) with text.
  `TripTable` shows the rows in API order; its Date, Cost and CO₂ header buttons (`aria-sort` on the `<th>`)
  change the page's sort, which goes to the API.
  **Delete** is a soft delete and always goes through the glass confirm `Dialog` (card quick action, "⋯" menu,
  list row, expanded row, trip details). Each of them emits `deleteRequested`; the page keeps a `TripDeletion`
  (`features/trips/trip-deletion.ts`, provided per page: `pending`, `busy`, `error`, `request`, `cancel`,
  `confirm(hooks)`) and renders `<app-trip-delete-dialog>` ("Delete trip?", the trip title, Cancel and a danger
  Delete). A failed DELETE stays in the dialog as an error message. On success the dialog closes, the page's
  `deleted` hook runs (Trips: the trip leaves the list, a page that became empty steps back one page, list and
  stats reload; details: navigate to `/trips`) and an info toast
  `Deleted "<title>"` with Undo shows for `UNDO_TOAST_MS` (10 s, shorter than the API's 30 s restore window) and
  takes focus on its Undo button (`ToastRequest.focus`), because the deleted trip's own button is gone. The
  dialog also returns focus to `fallbackFocus` (the Trips heading, `tabindex="-1"`) when its opener was removed. Undo calls `TripApi.restore` and then the
  `restored` hook (Trips: announce, reload list and stats; details: navigate to `/trips/:id`); if the restore
  fails (e.g. 409) an error toast says "Couldn't restore "<title>". <API message>". The toast and the restore
  outlive the page that deleted.
  **New / edit trip page** (`TripFormPage`): from 1280 px three columns that fill the page area
  (`calc(var(--stage-height) - 2 * var(--space-8))`, `#main` up to 100rem): "Describe your trip" (`TripDraftInput`:
  hint, 5-row textarea, three example chips from `DRAFT_EXAMPLES` that fill the text field and focus it without
  sending, full-width primary "Fill in the form") | the globe | the fields; editing drops the description column.
  `TripForm` renders two blocks, a `.map-panel` with the `RouteMap` and a `.fields` card (`aria-label="Trip
details"`, projected content such as the save error at its top), and its host is `display: contents`, so both
  are items of the page's grid. Its `columns` input (the page passes `LayoutBreakpoint` `wide`) makes the globe
  `fill` its glass panel with `greedy` gestures and turns the description and fields cards into focusable
  regions that scroll inside themselves (the page does not scroll). The Create / Cancel bar is sticky at the bottom of the fields card (opaque glass), so the primary action is always visible; spacing is tighter and date and travelers share a row.
  Below 1280 px the blocks stack (describe, globe, form, max 44rem), the globe keeps its shape with `cooperative`
  gestures and the page scrolls.
  **Duplicate** is a link to `/trips/new` with router navigation state `{ draft }` (`duplicateState`);
  `TripFormPage` reads it once (`presetFromState`: invalid fields dropped, ignored when editing) and the
  user still saves.
- **List view** (`TripTable`, `TripRowDetails`, `TripPrioritySelect`, `Pagination`): a click on a row, Enter or
  Space on a focused row, or its disclosure button expands it inline (one row at a time, `expandedId`; the button
  has `aria-expanded`, and `aria-controls` while open). The page loads that trip's `TripApi.compare(id)` on the
  first expand only, keeps the result in `details` (`RowDetail`: loading, error with retry, ready) for its
  lifetime and reloads it after a priority change. `TripRowDetails` shows each leg's recommended option side by
  side (mode icon and name, time, cost, CO₂), the weather lines and Open on map (`/trips/:id`), Edit and Delete;
  the buttons are there while loading or after an error; API values only, no maths. The Priority column is a
  native `<select>` (`TripPrioritySelect`) that reports the choice; the page's `move` applies it optimistically
  and rolls it back with an error toast and Retry. Below 768 px the Date, Mode, Priority and CO₂ columns fold
  into the second line under the title (priority is changed in the "⋯" menu there) and the expanded row stacks.
  **Keyboard model:** a table with a disclosure button per row and a roving tabindex on those buttons. The
  table body is one tab stop: the `.toggle` button of the active row (last focused, else the first) has
  `tabindex="0"`, the others `-1`, and so do the links, buttons and selects inside the other rows (an
  `afterRenderEffect` re-applies this when rows, details or the active row change; controls that appear in the
  active row, such as an opened menu panel, are tabbable as usual). Tab from the active toggle goes through its
  own row's controls and then leaves the table. ArrowUp/ArrowDown, Home and End move focus between the toggles
  (also from a title link, not from a select); Enter and Space are the native button's, with `aria-expanded`;
  Escape collapses the expanded row (from the toggle or from inside its details) and keeps focus on the toggle,
  unless one of its menus is open (Escape closes that first). Focus entering any control of a row makes that row
  the tab stop. A click on the row's own cells expands it; clicks inside links, buttons, the priority select or a
  menu panel do not. The title link keeps working. An expanded row hides its hover quick actions (its details
  have Open on map, Edit and Delete); the "⋯" menu stays. Under `(pointer: coarse)` the toggle, priority select
  and quick actions are 44 px.
- **Pagination:** the board loads up to 100 trips; the list asks the API for 20 per page (`page`, `size`) and
  `Pagination` (`shared/ui/`: zero-based `page`, `totalPages`, `totalItems`, `pageSize`, `itemCount`) shows
  "21–40 of 45 trips", Previous, "Page 2 of 3" and Next (wraps on phones, hidden for one page; at an end the
  button is `aria-disabled`, not `disabled`, so focus stays). A change of search, chips, sort or view goes back to
  page 0 (`pageIndex` is a `linkedSignal` over those); the previous page stays visible while the next loads.
- **Changing a trip's priority** (Trips page): `TripListPage.move` builds the existing update request from the
  trip in the list (`moveRequest`, `list/trip-move.ts`: all fields, stops as city ids, date unchanged) and calls
  `TripApi.update`. It is optimistic (`withPriority` in place, so the order is kept; `aria-busy` on the card/row
  while pending), merges the response into the item and reloads the list and stats (the priority weights
  the recommendation), and on failure restores the priority and shows an error `ToastService` toast with Retry.
  Three ways in: the list row's priority select, the "Move to …" items of `TripMenu` (keyboard, touch) and dragging on `TripBoard`, which is
  hand-written with pointer events (no CDK): a mouse/pen drag starts after `DRAG_THRESHOLD_PX`, a finger after a
  `LONG_PRESS_MS` press (moving earlier means scrolling); `board-drag.ts` holds the pure hit test (`columnAt`
  over the columns' rects). The ghost is a clone of the card on `<body>`; the original stays as a dashed
  placeholder, the column under the pointer gets `column--target`; Escape or a drop outside cancels, a drop on
  the own column is ignored, and the click after a drag is swallowed. A polite live region on the page announces
  "Moved "<title>" to …".
- **Menu, popover, dialog, filter group, toast** (`shared/ui/`): `Menu` (placements `below`, `beside`, `end`; `end` opens right of the trigger and is opaque) is a disclosure (built-in `IconButton` trigger via
  `label` + `menuIcon`, or your own `menuTrigger` button; panel content in `<ng-template appMenuContent>`,
  rendered only while open; Escape and outside click close (Escape returns focus to the trigger; an Escape from a dialog over the menu does not close it), an item
  click closes unless `closeOnSelect` is off; arrow keys move between items; `aria-expanded` and `aria-controls`
  on the trigger). `Menu` is also the **popover** building block: with `focusOnOpen` focus moves to the first
  item when it opens (or when its first item renders later, if focus is still on the trigger), the panel may hold any content (the account panel) and `(openChange)` tells the owner
  when to load data. `Dialog` is a modal confirmation on a native `<dialog>` with `showModal()` (the browser traps
  focus and makes the page inert; Escape and a backdrop click ask to cancel; focus starts on Cancel and returns
  to the element that had it, else `fallbackFocus`; while `busy` it cannot be dismissed and reopens if the browser closes it): inputs `open`, `title`, `confirmLabel`,
  `busyLabel`, `busy`, projected text, outputs `confirmed` and `cancelled`; the parent owns `open`. `Modal` is the
  same native modal for content that asks no question (the search palette, the shortcuts list): inputs `open`,
  `title`, `position` (`center` | `top`), output `closed` (Escape, close button, backdrop); focus starts on the
  projected element marked `data-autofocus`, else the close button, and returns to the opener. jsdom has no
  `showModal()`: specs call `installDialogSupport()` (`dialog.testing.ts`). `FilterGroup` is a `role="group"` of
  `aria-pressed` chips with `options`, a `selected` model and an optional `appFilterIcon` template.
  `ToastService.show({ message, kind, action?, durationMs?, focus? })` plus one `<app-toast-outlet>` in `app.ts`
  (auto-dismiss after `durationMs`, default 5 s, the Undo toast uses 10 s; paused on hover and focus; errors in `role="alert"`, info in `role="status"`).
- **Explorer state** is mirrored in the URL (`from`, `to`, `date`, `travelers`,
  `priority`; defaults left out).
- **Query parameters** also arrive as component inputs; `/trips/new` accepts
  `from`, `to`, `date`, `travelers`, `priority` and ignores invalid values.
- **Destructive actions:** never a one-click delete: confirm in `<app-dialog>` (trip delete, see Trips list) and
  offer Undo where the API can restore.
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
  Glass look: a fixed `.glow-layer` element in `app.ts` (`aria-hidden`, four large radial blobs: soft grey, olive,
  warm at 55/55/50% centre alpha and a little lime at 16%, tokens `--color-smoke|olive|warm-aNN`; static, because the
  shell's full-viewport blur would be recomputed every frame if they moved; also shown under reduced transparency) sits behind all
  content, so no ancestor of a glass surface may have an opaque background. The whole app lives in one `AppShell`
  (`shared/ui/app-shell.ts`): a rounded glass shell (`--shell-radius` 32 px, 20 px on phones) with a small outer
  margin (`--shell-margin` 16 px, 6 px on phones). Its glass is a `::before` sibling layer (`--glass-bg-shell`:
  midnight black 50%, blur, border), never the shell itself, so panels, menus and the rail blur the real backdrop
  and the globe never sits inside a backdrop root. The page area (`.page` in `app.ts`, `tabindex="-1"`, focused on first render and on route changes unless focus is inside it or in an open menu, so Space/PageDown scroll it; the skip link focuses `#main` itself because of `<base href>`) scrolls, not the window
  (`body` is `overflow: hidden`) and returns to the top when the route path changes (not for query changes).
  Glass = `background: var(--glass-bg)` (white 8%) or `--glass-bg-strong` (white 12%, controls and active items) or
  `--glass-bg-menu` (surface 85%, dropdowns and listboxes over arbitrary content), plus
  `backdrop-filter: var(--glass-filter)` (+ `-webkit-`; blur 28 px and saturate 180%),
  `border: 1px solid var(--glass-border)` (white 18%) and `box-shadow: var(--glass-highlight)` (inner top
  highlight; combine it with any other shadow). Alpha variants are written as `--color-*-aNN` (NN = percent;
  same hues, add one only when used). `backdrop-filter` goes on the few top-level surfaces (shell layer, icon rail,
  panels, sheet, menus, toolbar search; not chips or icon buttons); never on list cards or table rows (fill, border and highlight
  only), not on the header bar (the shell is its glass) and not on elements nested in a glass panel (a
  backdrop-filter ancestor limits what they can blur).
  Contrast rule: white, muted and lime text must stay 4.5:1 and control borders (`--color-border-strong`, white
  60%) 3:1 on the fills over the brightest backdrop point. Budget: the backdrop under the shell tint peaks at
  L about 0.03 (two blobs overlapping count as one peak plus half the other), then panel (+8% white) and control
  (+12% white) fills stack. Text colours: `--color-text-muted` is #e2e6ed and styles every placeholder (global `::placeholder`). Numbers at
  the brightest point (olive plus half of grey, shell 50%): on panels white 8.6:1, muted 6.8:1, lime 6.4:1; on
  12% controls white 6.1:1, muted 4.9:1, lime 4.6:1; control borders 3.4:1. Re-run the check (a small script over
  the blob alphas, the shell tint and the fill stack) when raising a blob, the tint or a fill.
  Under `prefers-reduced-transparency` the glass surfaces become opaque and a little lighter
  (`--color-surface-raised`, `--color-surface-raised-strong`, solid lane tints) with the same borders and highlight,
  and `--glass-filter: none`; the backdrop glows and the shell tint stay visible, so the app never turns flat black.
  Never hard-code a blur or a translucent fill. Headless Chromium reports reduced transparency, so
  `npm run screenshots` emulates `no-preference`, except for the `home-route-reduced-transparency` capture.
  Dark theme only (see Theme). Radii: `--radius-lg`
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
- **Theme:** dark only (`color-scheme: dark` in `:root`, `<meta name="color-scheme" content="dark">`). There is
  no theme service, menu or `data-theme`. The semantic aliases (`--color-primary-ink`, `--color-selected-bg`,
  `--color-highlight-edge`, `--color-danger-text` …) remain and currently equal their dark values; use them for
  the roles they name (lime text, selected background, recommended edge) so a future theme has one place to change.
- **Shell, header and rail:** `AppShell` projects `shellHeader`, an optional `shellRail` and the page area. `Header`
  is the top bar (logo tile, centred `PillNav` Home / Trips / Modes, round search and new-trip buttons (only below 1024 px, where there is no rail), avatar popover
  or "Log in"; below 768 px the collapsed navigation menu). **Account popover:** the avatar is the trigger of a
  `Menu` (`focusOnOpen`, id `account-menu`) holding `AccountPanel`: initials, display name and email (from
  `Session`), trips planned and CO₂ saved from `TripApi.stats()` (requested each time a panel opens, never at
  start-up; while loading or after a failure a short note replaces the figures and the links stay usable), a
  "My trips" link and Log out with an icon (through `Session`). Below 768 px the same `AccountPanel` sits in the
  collapsed navigation menu under the links. "Search" (the header button below 1024 px, and the first rail item) opens the `CommandPalette` through `PaletteState`. `IconRail` (`shared/ui/icon-rail.ts`, rendered by `app.ts` only while
  `LayoutBreakpoint.desktop()`, from 1024 px) is a labelled `nav` of round items: links get `aria-current="page"`
  (exact path match, query ignored) and a lime ring, an item with a `popover` template opens it in a `Menu`
  (`placement="end"`, `focusOnOpen`) to the right of the rail, other buttons emit `activate`; every item has
  `aria-label` and a `title` tooltip (plus its `shortcut`, also as `aria-keyshortcuts`). The rail sits above the
  page area (`z-index`) so its popover covers the page. **Rail items are global tools, not pages** (the pages are
  in the top nav): Search (opens `CommandPalette`), New trip (link), Upcoming trips (popover with `UpcomingTrips`:
  the next 5 trips from today, `TripApi.search({ sort: 'date', direction: 'asc', from: <today ISO>, size: 5 })`,
  requested each time it opens; route, date and recommended mode via `tripEntries`/`modeSummary`; each opens
  `/trips/:id`; logged out a "Log in" link; loading, error and empty state "No upcoming trips") and Keyboard shortcuts
  (`ShortcutsDialog`, the list in `SHORTCUT_GROUPS`: keep it in step with the components' keys; `?` outside text fields opens it too).
  **Loaded on demand:** `app.ts` wraps the palette and the shortcuts dialog in `@defer (when …isOpen())` and the
  Upcoming trips content in `@defer (on immediate)` inside its popover, so they stay out of the initial bundle; a
  closed palette or dialog is not in the DOM until it is first opened.
  **Search palette** (`layout/command-palette/`): `PaletteState` holds `isOpen`; Ctrl+K / Cmd+K, by `key` or by physical `code === 'KeyK'` for non-Latin layouts (`document:keydown`
  on the root) opens it on every page and width, also from inside a text field, but not while another dialog is open (the new overlay would take that dialog's content as its opener and lose focus when both close; same for `?`). Menus ignore an Escape that came from a dialog or was handled; `Modal` returns focus to its opener, else to `#main`. While a new search loads the previous results stay (`aria-busy` on the listbox), the highlight stays on the same option and Enter waits for the current text's results. Options take no focus (focus stays in the input, `aria-activedescendant`). It is a `Modal` (`position="top"`)
  with one ARIA combobox (`aria-controls` the listbox, `aria-activedescendant` the highlighted option) over a
  listbox with two groups: cities (`CityApi.findAll(q)`, first 5) and, when logged in, the user's trips
  (`TripApi.search({ q, size: 5 })`), requested 200 ms after typing stops (`PALETTE_DEBOUNCE_MS`). Arrows move
  (wrapping), Enter or a click chooses: a city goes to Home's From, or To once Home has a From
  (`home-target.ts`: `homeFieldFor`, `homeQueryFor`; on Home the rest of its query is kept), a trip opens
  `/trips/:id`. A `role="status"` line counts the results; failures show `<app-error-message>` with retry.
  Escape (or the close button, or the backdrop) closes it and focus returns to the opener; it opens empty.
  `/modes` is the Modes page.
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
