import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WeatherSummary } from '../../core/api/models';
import { HAZARD_LABELS } from '../../shared/util/labels';

let nextId = 0;

/**
 * Forecast for the travel date in the origin and destination, as returned with
 * a comparison. The API sends nothing outside its forecast window, which is
 * stated in words. Amber marks weather; hazards also carry a warning sign and
 * their name, so colour is never the only signal.
 */
@Component({
  selector: 'app-weather-card',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="weather" [attr.aria-labelledby]="headingId">
      <h3 class="weather__title" [id]="headingId">Weather on {{ date() | date: 'mediumDate' }}</h3>
      @if (weather().length === 0) {
        <p class="muted weather__empty">
          No forecast for this date yet, so the weather is not taken into account. Forecasts cover
          about the next two weeks.
        </p>
      } @else {
        <ul class="weather__list">
          @for (item of weather(); track item.city) {
            <li class="weather__city">
              <span class="weather__name">{{ item.city }}</span>
              <span class="weather__description">{{ item.description }}</span>
              <span class="weather__facts">
                @if (item.temperatureMinC !== null && item.temperatureMaxC !== null) {
                  <span>
                    {{ item.temperatureMinC | number: '1.0-0' }} to
                    {{ item.temperatureMaxC | number: '1.0-0' }} °C
                  </span>
                }
                @if (item.precipitationProbabilityPercent !== null) {
                  <span>{{ item.precipitationProbabilityPercent }}% precipitation</span>
                }
                @if (item.windSpeedMaxKmh !== null) {
                  <span>wind up to {{ item.windSpeedMaxKmh | number: '1.0-0' }} km/h</span>
                }
              </span>
              @if (item.hazards.length > 0) {
                <span class="weather__hazards">
                  @for (hazard of item.hazards; track hazard) {
                    <span class="weather__hazard">⚠ {{ hazardLabels[hazard] }}</span>
                  }
                </span>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .weather {
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--glass-border);
      border-left: 4px solid var(--color-accent);
      border-radius: var(--radius-md);
      background: var(--glass-bg-strong);
      box-shadow: var(--glass-highlight);
    }

    .weather__title {
      margin: 0 0 var(--space-2);
      font-size: 1rem;
    }

    .weather__empty {
      margin: 0;
      max-width: 60ch;
      font-size: 0.9375rem;
    }

    .weather__list {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .weather__city {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-3);
      font-size: 0.9375rem;
    }

    .weather__name {
      flex: 1 0 100%;
      font-weight: 700;
    }

    .weather__description {
      color: var(--color-accent-text);
      font-weight: 600;
    }

    .weather__facts {
      display: flex;
      flex-wrap: wrap;
      gap: 0 var(--space-3);
      color: var(--color-text-muted);
    }

    .weather__hazards {
      display: flex;
      flex: 1 0 100%;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-2);
    }

    .weather__hazard {
      padding: 0 var(--space-2);
      border: 1px solid var(--color-accent);
      border-radius: var(--radius-pill);
      color: var(--color-accent-text);
      font-size: 0.8125rem;
      font-weight: 700;
    }
  `,
})
export class WeatherCard {
  /** Forecasts for the route's cities; empty when the date is outside the forecast window. */
  readonly weather = input.required<WeatherSummary[]>();
  /** Travel date (ISO), shown in the heading. */
  readonly date = input.required<string>();

  protected readonly hazardLabels = HAZARD_LABELS;
  protected readonly headingId = `weather-card-${nextId++}`;
}
