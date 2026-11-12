import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiError, FieldError } from '../../core/api/api-error';
import { CityApi } from '../../core/api/city-api';
import { AdvisorApi } from '../../core/api/advisor-api';
import { TripDraft, TripRequest } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { PRIORITIES } from '../../shared/util/labels';
import { TripDraftInput } from './trip-draft-input';
import { TripForm, TripPreset } from './trip-form';

/**
 * Creates a trip (`/trips/new`) or edits one (`/trips/:id/edit`). A new trip can
 * be prefilled from a free-text description.
 */
@Component({
  selector: 'app-trip-form-page',
  imports: [ErrorMessage, Spinner, TripDraftInput, TripForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <h1>{{ id() ? 'Edit trip' : 'New trip' }}</h1>
    </div>

    @if (!id()) {
      <section class="card draft" aria-label="Describe your trip">
        <app-trip-draft-input
          [busy]="parsing()"
          [draft]="draft()"
          [error]="parseError()"
          (parse)="parseDescription($event)"
        />
      </section>
    }

    <section class="card">
      @if (cities.isLoading() || trip.isLoading()) {
        <app-spinner label="Loading…" />
      } @else if (cities.error() ?? trip.error(); as error) {
        <app-error-message [error]="error" (retry)="reload()" />
      } @else if (cities.value(); as cityList) {
        @if (saveError(); as error) {
          <div class="save-error">
            <app-error-message [error]="error" [retryable]="false" />
          </div>
        }
        <app-trip-form
          [cities]="cityList"
          [trip]="trip.value() ?? null"
          [draft]="draft()"
          [preset]="preset()"
          [submitting]="saving()"
          [serverErrors]="fieldErrors()"
          [cancelLink]="cancelLink()"
          (submitted)="save($event)"
        />
      }
    </section>
  `,
  styles: `
    .card {
      max-width: 44rem;
    }

    .draft {
      margin-bottom: var(--space-6);
    }

    .save-error {
      margin-bottom: var(--space-4);
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
  protected readonly cancelLink = computed(() => (this.id() ? `/trips/${this.id()}` : '/trips'));

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
