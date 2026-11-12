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
    ├── shared/map/      route map (SVG) and its pure projection maths
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
- **Map and charts:** hand-drawn SVG/HTML, no library. `RouteMap` places cities
  with `createProjection` (Mercator) over the land shapes in `europe-land.ts`
  (generated from Natural Earth; regenerate, do not edit). Zoom and pan change
  the `viewBox` (`viewport.ts`); marks and text are sized per CSS pixel via
  `unit()`; labels are placed by `layoutLabels` (no overlaps). It is
  presentational and emits the selection (origin/destination), or, with
  `[stops]` (an ordered list of city ids), draws every leg with numbered pins
  and emits `cityPick` instead. With `[wide]="true"` (home page) a map
  at least 720 px wide shows the whole land outline in a landscape view; below
  that, and on the small maps, it keeps the near-square view. `[fill]` makes the map fill its
  container (Home wide and narrow), `controls` (`corner` | `bottom`) places the zoom buttons and
  `insetStart`/`insetEnd` (px) keep the fitted route clear of floating panels. The route is
  drawn with a non-scaling stroke and no dash pattern, so it stays crisp when zooming. The land data
  (`europe-land.ts`) comes from `scripts/gen-europe-land.py`; its box must match
  `LAND_WEST`/`LAND_EAST` in `route-map.ts`. `ComparisonChart` shows one metric at a time (switched with `Tabs`) with the
  recommended mode as the only accent bar (`--color-highlight`, others
  `--color-bar`). Neither may be the only way to get information: keep a
  text or form equivalent (dropdowns for the map, the table for the chart)
  and state selection in text and `aria-pressed`, not color alone.
  Mode icons (`ModeIcon`) are decorative and always sit next to the name.
- **City choice:** `CityPicker` (ARIA combobox) next to every interactive map;
  priorities with `PriorityPicker`.
- **Comparisons are per leg:** the API returns `legs`, `recommendedItinerary`
  and `singleModeTotals`. `ComparisonChart`, `ComparisonPanel` and
  `comparisonInsight` work on one leg (`LegComparison`, built with
  `legComparison(comparison, index)`). A two-stop trip and the home explorer
  show that single leg as before; a multi-stop trip uses `ItineraryView`
  (leg timeline, whole-trip totals, each leg's details).
- **Home layouts** (`LayoutBreakpoint.layout()`: `wide` >= 1280 px, `medium` 768-1279 px,
  `narrow` < 768 px): wide = full-bleed map with two floating `GlassPanel`s (settings left, with the
  page `<h1>`; results right, with `WeatherCard`), both collapsible; medium = map, settings and
  results stacked; narrow = map plus a `BottomSheet` (peek/expanded, draggable) with settings and results.
- **Trips list** (`features/trips/list/`): `TripToolbar` (row 1: search, Board/List
  `SegmentedToggle`, New trip; row 2: `FilterGroup`s Priority and Mode with counts from the full list;
  result count "3 of 5 trips" in a `role="status"` and "Clear filters"; below 768 px the groups move
  into a `BottomSheet` opened by a "Filters" button), `TripBoard` (columns by priority), `TripTable`,
  `TripCard`, `TripMenu` (built on `Menu`); `trip-figures.ts` derives cost, CO₂ and KPIs from each trip's
  comparison (no extra API), `trip-filters.ts` the counts, the result summary and `sortTrips`/`toggleSort`.
  Cards and rows open the trip as a whole: the title link carries an `::after` stretched over the card/row
  (one tab stop; the focus ring is drawn on the card via `:has(a:focus-visible)`), the "⋯" menu and
  `TripActions` (quick icon buttons Open, Edit, Duplicate, Delete) sit above it with a higher z-index. Quick
  actions show on hover and on focus within, never under `(hover: none)`; Delete swaps them for the inline
  `ConfirmAction` (`asking`, `showTrigger`). Hover/focus lifts the card 2 px with an edge in its tint
  (`--color-highlight-edge`, `--color-accent-edge`) and no motion under reduced motion. `TripRoute` is the
  decorative (`aria-hidden`) mini route line: a dot per stop, the leg's mode icon between them (`legModes`).
  The CO₂ bar shows the plan against the car (car = 100 %) with text. `TripTable` sorts by Date, Cost and CO₂
  (header buttons, `aria-sort` on the `<th>`, trips without figures last); the sort lives in the page.
  **Duplicate** is a link to `/trips/new` with router navigation state `{ draft }` (`duplicateState`);
  `TripFormPage` reads it once (`presetFromState`: invalid fields dropped, ignored when editing) and the
  user still saves.
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
