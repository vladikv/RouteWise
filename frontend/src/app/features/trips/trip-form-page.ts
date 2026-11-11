import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiError, FieldError } from '../../core/api/api-error';
import { CityApi } from '../../core/api/city-api';
import { TripRequest } from '../../core/api/models';
import { TripApi } from '../../core/api/trip-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { TripForm } from './trip-form';

/** Creates a trip (`/trips/new`) or edits one (`/trips/:id/edit`). */
@Component({
  selector: 'app-trip-form-page',
  imports: [ErrorMessage, Spinner, TripForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <h1>{{ id() ? 'Edit trip' : 'New trip' }}</h1>
    </div>

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

    .save-error {
      margin-bottom: var(--space-4);
    }
  `,
})
export class TripFormPage {
  /** Route parameter; absent on `/trips/new`. */
  readonly id = input<string>();

  private readonly tripApi = inject(TripApi);
  private readonly cityApi = inject(CityApi);
  private readonly router = inject(Router);

  protected readonly cities = rxResource({ stream: () => this.cityApi.findAll() });
  protected readonly trip = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.tripApi.findById(Number(id)),
  });

  protected readonly saving = signal(false);
  protected readonly saveError = signal<unknown>(null);
  protected readonly fieldErrors = signal<FieldError[]>([]);
  protected readonly cancelLink = computed(() => (this.id() ? `/trips/${this.id()}` : '/trips'));

  protected reload(): void {
    this.cities.reload();
    this.trip.reload();
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
