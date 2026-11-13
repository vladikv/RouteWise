import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiError, FieldError } from '../../core/api/api-error';
import { CityApi } from '../../core/api/city-api';
import { AdvisorApi } from '../../core/api/advisor-api';
import { City, TripDraft, TripRequest } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { PRIORITIES } from '../../shared/util/labels';
import { LayoutBreakpoint } from '../../shared/util/layout-breakpoint';
import { TripDraftInput } from './trip-draft-input';
import { presetFromState } from './trip-duplicate';
import { TripForm, TripPreset } from './trip-form';

/**
 * Creates a trip (`/trips/new`) or edits one (`/trips/:id/edit`). A new trip can
 * be prefilled from a free-text description. From 1280 px: describe | globe | form in
 * columns that fit the viewport; below that the three blocks are stacked.
 */
@Component({
  selector: 'app-trip-form-page',
  imports: [ErrorMessage, Spinner, TripDraftInput, TripForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="trip-page" [class.trip-page--edit]="id()">
      <div class="page-header">
        <h1>{{ id() ? 'Edit trip' : 'New trip' }}</h1>
      </div>

      <div class="layout">
        @if (!id()) {
          <section
            class="card draft"
            aria-label="Describe your trip"
            [attr.tabindex]="columns() ? 0 : null"
          >
            <app-trip-draft-input
              [busy]="parsing()"
              [draft]="draft()"
              [error]="parseError()"
              (parse)="parseDescription($event)"
            />
          </section>
        }

        @if (cities.isLoading() || trip.isLoading()) {
          <section class="card status">
            <app-spinner label="Loading…" />
          </section>
        } @else if (cities.error() ?? trip.error(); as error) {
          <section class="card status">
            <app-error-message [error]="error" (retry)="reload()" />
          </section>
        } @else if (cities.value(); as cityList) {
          <app-trip-form
            [cities]="cityList"
            [trip]="trip.value() ?? null"
            [draft]="draft()"
            [preset]="preset()"
            [submitting]="saving()"
            [serverErrors]="fieldErrors()"
            [cancelLink]="cancelLink()"
            [columns]="columns()"
            (submitted)="save($event)"
          >
            @if (saveError(); as error) {
              <div class="save-error">
                <app-error-message [error]="error" [retryable]="false" />
              </div>
            }
          </app-trip-form>
        }
      </div>
    </div>
  `,
  styles: `
    /* Below 1280 px: one column (describe, globe, form) and the page scrolls. */
    .layout {
      display: grid;
      gap: var(--space-6);
      max-width: 44rem;
    }

    .save-error {
      margin-bottom: var(--space-4);
    }

    /*
     * From 1280 px: three columns that fill the page area, so the page does not scroll
     * (describe | globe | form; editing drops the description). A column whose content is
     * taller than the space scrolls inside itself.
     */
    @media (min-width: 80rem) {
      .trip-page {
        display: flex;
        flex-direction: column;
        height: calc(var(--stage-height) - 2 * var(--space-8));
        min-height: 34rem;
      }

      .page-header {
        margin-bottom: var(--space-4);
      }

      .layout {
        flex: 1;
        min-height: 0;
        grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr) minmax(24rem, 27rem);
        grid-template-rows: minmax(0, 1fr);
        gap: var(--space-4);
        max-width: none;
      }

      .trip-page--edit .layout {
        grid-template-columns: minmax(0, 1fr) minmax(24rem, 30rem);
      }

      .draft {
        min-height: 0;
        overflow-y: auto;
        scrollbar-color: var(--color-border-strong) transparent;
        scrollbar-width: thin;
      }

      /* Loading or failed: one card across the globe and form columns. */
      .status {
        grid-column: -3 / -1;
      }
    }
  `,
})
export class TripFormPage {
  /** Route parameter; absent on `/trips/new`. */
  readonly id = input<string>();
  /** Optional query parameters from the route explorer's "Save as trip". */
  readonly from = input<string>();
  readonly to = input<string>();
  readonly date = input<string>();
  readonly travelers = input<string>();
  readonly priority = input<string>();

  private readonly tripApi = inject(TripApi);
  private readonly cityApi = inject(CityApi);
  private readonly advisorApi = inject(AdvisorApi);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(LayoutBreakpoint);

  /** From 1280 px the page is laid out in columns that fit the viewport. */
  protected readonly columns = computed(() => this.breakpoint.layout() === 'wide');

  protected readonly cities = rxResource({ stream: () => this.cityApi.findAll() });
  protected readonly trip = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.tripApi.findById(Number(id)),
  });

  protected readonly saving = signal(false);
  protected readonly saveError = signal<unknown>(null);
  protected readonly fieldErrors = signal<FieldError[]>([]);
  protected readonly parsing = signal(false);
  protected readonly draft = signal<TripDraft | null>(null);
  protected readonly parseError = signal<unknown>(null);
  /**
   * Starting values for a new trip from the query parameters. Anything that is
   * not a known city, a valid date, 1–9 travelers or a known priority is ignored.
   */
  protected readonly preset = computed<TripPreset | null>(() => {
    const cities = this.cities.value();
    if (this.id() || !cities) {
      return null;
    }
    if (this.duplicated) {
      return this.knownStops(this.duplicated, cities);
    }
    const origin = cities.find((city) => city.id === Number(this.from()));
    const destination = cities.find((city) => city.id === Number(this.to()));
    const travelers = Number(this.travelers());
    const priority = PRIORITIES.find((option) => option === this.priority());
    const date = this.date();
    const preset: TripPreset = {
      ...((origin || destination) && { stops: [origin?.id ?? null, destination?.id ?? null] }),
      ...(origin && destination && { title: `${origin.name} to ${destination.name}` }),
      ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && { departureDate: date }),
      ...(Number.isInteger(travelers) && travelers >= 1 && travelers <= 9 && { travelers }),
      ...(priority && { priority }),
    };
    return Object.keys(preset).length > 0 ? preset : null;
  });
  /** A trip handed over by "Duplicate" in the navigation state (history state after a reload). */
  private readonly duplicated = presetFromState(
    this.router.currentNavigation()?.extras.state ?? history.state,
  );
  protected readonly cancelLink = computed(() => (this.id() ? `/trips/${this.id()}` : '/trips'));

  /** The preset with stops that are not known cities left to choose. */
  private knownStops(preset: TripPreset, cities: City[]): TripPreset {
    return preset.stops
      ? {
          ...preset,
          stops: preset.stops.map((id) => cities.find((city) => city.id === id)?.id ?? null),
        }
      : preset;
  }

  protected reload(): void {
    this.cities.reload();
    this.trip.reload();
  }

  /** Asks the advisor to turn a free-text description into a draft that prefills the form. */
  protected parseDescription(text: string): void {
    this.parsing.set(true);
    this.parseError.set(null);
    this.advisorApi.parse(text).subscribe({
      next: (draft) => {
        this.parsing.set(false);
        this.draft.set(draft);
        this.fieldErrors.set([]);
      },
      error: (error: unknown) => {
        this.parsing.set(false);
        this.parseError.set(error);
      },
    });
  }

  protected save(request: TripRequest): void {
    const id = this.id();
    this.saving.set(true);
    this.saveError.set(null);
    const saved$ = id ? this.tripApi.update(Number(id), request) : this.tripApi.create(request);
    saved$.subscribe({
      next: (trip) => void this.router.navigate(['/trips', trip.id]),
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof ApiError && error.isValidation) {
          this.fieldErrors.set(error.fieldErrors);
        } else {
          this.saveError.set(error);
        }
      },
    });
  }
}
