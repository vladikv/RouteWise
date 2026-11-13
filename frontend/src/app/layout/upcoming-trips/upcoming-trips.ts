import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TripApi } from '../../core/api/trip-api';
import { Session } from '../../core/auth/session';
import { modeSummary, tripEntries } from '../../features/trips/list/trip-figures';
import { ErrorMessage } from '../../shared/ui/error-message';
import { ModeIcon } from '../../shared/ui/mode-icon';
import { Spinner } from '../../shared/ui/spinner';
import { todayIso } from '../../shared/util/date';

/** How many trips the popover lists. */
export const UPCOMING_TRIPS = 5;

/**
 * Content of the rail's Upcoming trips popover: the user's next 5 upcoming trips (from today, soonest first)
 * (route, date, recommended mode), each opening the trip on its globe. Loaded each time the
 * popover opens (it is only rendered while open). Logged out: a link to log in.
 */
@Component({
  selector: 'app-upcoming-trips',
  imports: [DatePipe, RouterLink, ErrorMessage, ModeIcon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="title" id="upcoming-trips-title">Upcoming trips</p>
    @if (!loggedIn()) {
      <a class="more" routerLink="/login">Log in to see your trips</a>
    } @else if (trips.isLoading()) {
      <app-spinner label="Loading trips…" />
    } @else if (trips.error(); as error) {
      <app-error-message [error]="error" (retry)="trips.reload()" />
      <a class="more" routerLink="/trips">All trips</a>
    } @else if (entries().length === 0) {
      <p class="note">No upcoming trips</p>
      <a class="more" routerLink="/trips/new">Plan a trip</a>
    } @else {
      <ul aria-labelledby="upcoming-trips-title">
        @for (entry of entries(); track entry.trip.id) {
          <li>
            <a class="trip" [routerLink]="['/trips', entry.trip.id]">
              <span class="trip__title">{{ entry.trip.title }}</span>
              <span class="trip__meta">
                {{ entry.trip.departureDate | date: 'mediumDate' }}
                @if (entry.figures; as figures) {
                  ·
                  @if (figures.mode !== 'MIXED') {
                    <app-mode-icon [mode]="figures.mode" />
                  }
                  {{ summary(figures) }}
                }
              </span>
            </a>
          </li>
        }
      </ul>
      <a class="more" routerLink="/trips">All trips</a>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-1);
      width: 18rem;
      max-width: 100%;
    }

    .title {
      margin: var(--space-1) var(--space-2);
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 700;
    }

    ul {
      display: grid;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .trip,
    .more {
      display: grid;
      gap: 0.1rem;
      padding: var(--space-2);
      border-radius: var(--radius-md);
      color: var(--color-text);
      text-decoration: none;
    }

    .trip:hover,
    .trip:focus-visible,
    .more:hover,
    .more:focus-visible {
      background: var(--glass-bg-strong);
    }

    .trip__title {
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .trip__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-muted);
      font-size: 0.8125rem;
    }

    .trip__meta app-mode-icon {
      width: 1rem;
      height: 1rem;
    }

    .more {
      color: var(--color-primary-ink);
      font-weight: 600;
    }

    .note {
      margin: 0 var(--space-2);
      color: var(--color-text-muted);
    }
  `,
})
export class UpcomingTrips {
  private readonly tripApi = inject(TripApi);
  protected readonly loggedIn = inject(Session).loggedIn;
  protected readonly summary = modeSummary;

  protected readonly trips = rxResource({
    params: () => (this.loggedIn() ? true : undefined),
    stream: () =>
      this.tripApi.search({
        sort: 'date',
        direction: 'asc',
        from: todayIso(),
        size: UPCOMING_TRIPS,
      }),
  });
  protected readonly entries = computed(() =>
    this.trips.hasValue() ? tripEntries(this.trips.value()) : [],
  );
}
