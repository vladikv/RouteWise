import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip, TripPriority } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { daysBetween, todayIso } from '../../../shared/util/date';
import { countdownLabel, travelersLabel } from '../../../shared/util/labels';
import { modeSummary, TripFigures } from './trip-figures';
import { TripActions } from './trip-actions';
import { TripMenu } from './trip-menu';
import { TripRoute } from './trip-route';

/**
 * A trip on the board: date with a countdown, route (stops as text plus a mini route line),
 * the recommended plan's cost, CO₂ against going by car, and its mode. Tinted by the priority
 * of its lane (`trip--fastest` …); the lane header names the priority, the card names the mode.
 * The whole card opens the trip: the title link is stretched over it, the quick actions and the
 * menu sit above that link.
 */
@Component({
  selector: 'app-trip-card',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    ModeIcon,
    TripActions,
    TripMenu,
    TripRoute,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-card.html',
  styleUrl: './trip-card.scss',
})
export class TripCard {
  readonly trip = input.required<Trip>();
  /** From the API; null when no route is available. */
  readonly figures = input.required<TripFigures | null>();
  readonly deleting = input(false);
  /** A priority change is waiting for the API. */
  readonly moving = input(false);
  readonly deleted = output<void>();
  readonly moved = output<TripPriority>();

  protected readonly travelersLabel = travelersLabel;
  protected readonly modeSummary = modeSummary;
  protected readonly lane = computed(() => this.trip().priority.toLowerCase());
  private readonly daysUntil = computed(() => daysBetween(todayIso(), this.trip().departureDate));
  protected readonly countdown = computed(() => countdownLabel(this.daysUntil()));
  protected readonly past = computed(() => this.daysUntil() < 0);
  /** The recommended CO₂ as a share of the car's (0–1), null without a car figure. */
  protected readonly share = computed(() => this.figures()?.co2ShareOfCar ?? null);
  /** Only a plan below the car's CO₂ gets the accent bar; equal or more stays gray. */
  protected readonly saves = computed(() => {
    const percent = this.figures()?.co2VsCarPercent ?? null;
    return percent !== null && percent < 0;
  });
  /** "−81 %" (or "+12 %") against the car; empty when it is the same as the car. */
  protected readonly vsCar = computed(() => {
    const percent = this.figures()?.co2VsCarPercent ?? null;
    if (percent === null || percent === 0) {
      return '';
    }
    return percent < 0 ? `−${-percent} %` : `${percent > 0 ? '+' : ''}${percent} %`;
  });
}
