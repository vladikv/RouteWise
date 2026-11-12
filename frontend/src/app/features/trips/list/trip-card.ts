import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { daysBetween, todayIso } from '../../../shared/util/date';
import { countdownLabel, travelersLabel } from '../../../shared/util/labels';
import { FigureState, modeSummary, tintFor, TripFigures } from './trip-figures';
import { TripMenu } from './trip-menu';

/**
 * A trip on the board: date, route, the recommended plan's cost and CO₂ and its
 * mode. Tinted by mode (see `tintFor`); the mode is always named in text.
 */
@Component({
  selector: 'app-trip-card',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, ModeIcon, TripMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-card.html',
  styleUrl: './trip-card.scss',
})
export class TripCard {
  readonly trip = input.required<Trip>();
  readonly state = input.required<FigureState>();
  readonly deleting = input(false);
  readonly deleted = output<void>();

  protected readonly travelersLabel = travelersLabel;
  protected readonly modeSummary = modeSummary;
  protected readonly figures = computed<TripFigures | null>(() => {
    const state = this.state();
    return state.status === 'ready' ? state.figures : null;
  });
  protected readonly tint = computed(() => {
    const figures = this.figures();
    return figures ? tintFor(figures.mode) : 'none';
  });
  protected readonly countdown = computed(() =>
    countdownLabel(daysBetween(todayIso(), this.trip().departureDate)),
  );
}
