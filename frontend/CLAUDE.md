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
    ├── layout/          app chrome: header (nav, account)
    ├── shared/ui/       presentational building blocks (spinner, error message, confirm action)
    ├── shared/map/      route map (SVG) and its pure projection maths
    ├── shared/util/     pure helpers (dates, labels)
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
  that, and on the small maps, it keeps the near-square view. The land data
  (`europe-land.ts`) comes from `scripts/gen-europe-land.py`; its box must match
  `LAND_WEST`/`LAND_EAST` in `route-map.ts`. `ComparisonChart` shows one metric at a time with the
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
- **Explorer state** is mirrored in the URL (`from`, `to`, `date`, `travelers`,
  `priority`; defaults left out).
- **Query parameters** also arrive as component inputs; `/trips/new` accepts
  `from`, `to`, `date`, `travelers`, `priority` and ignores invalid values.
- **Destructive actions:** `<app-confirm-action>` (inline two-step confirm),
  never a one-click delete.
- **Async views:** load with `rxResource` and render all states: loading
  (`<app-spinner>`), error with retry, empty, and data.
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
  Glass look: translucent surfaces use the `--glass-bg`, `--glass-bg-strong`,
  `--glass-border` and `--glass-blur` tokens, built from alpha variants of the
  palette (`--color-surface-a60`, `--color-primary-a12`, … NN = percent; same
  hues, add a variant only when used). Keep surface alpha at 60% or more for
  contrast and use few stacked `backdrop-filter` layers. Under
  `prefers-reduced-transparency` the glass tokens become solid surfaces with no
  blur, so never hard-code a blur or a translucent fill. Radii: `--radius-lg`
  (cards), `--radius-md`, `--radius-pill` (buttons, inputs, badges). A fixed
  `body::before` draws the lime glows. Type: 17 px body, Manrope (loaded in
  `index.html`, weights 400-800) is the only font (`--font-sans`; `--font-display`
  is an alias). Shared classes: `.card`, `.button` (`--primary`,
  `--danger`), `.page-header`, `.actions`, `.badge` (`--recommended`),
  `.segmented` (radio group as buttons), `.field` (`__hint`, `__error`),
  `.muted`, `.visually-hidden`. Component styles stay small (4 kB budget).
- **Theme:** one dark theme only (`color-scheme: dark`); there is no theme
  toggle. Do not add light-mode styles.
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
