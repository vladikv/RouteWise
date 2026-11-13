import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Comparison, ModeOption, Trip, WeatherSummary } from '../../../core/api/models';
import { ErrorMessage } from '../../../shared/ui/error-message';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { Spinner } from '../../../shared/ui/spinner';
import { MODE_LABELS, durationLabel } from '../../../shared/util/labels';

/** The state of one row's lazily loaded comparison. */
export type RowDetail =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; comparison: Comparison };

/**
 * The inside of an expanded list row: each leg's recommended mode with its time, cost and CO₂
 * side by side, the weather summary, and Open on map, Edit and Delete. Every number is the API's
 * (`GET /api/trips/{id}/comparison`); this component only lays them out. The buttons are there
 * while the comparison loads or has failed.
 */
@Component({
  selector: 'app-trip-row-details',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, ErrorMessage, ModeIcon, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-row-details.html',
  styleUrl: './trip-row-details.scss',
})
export class TripRowDetails {
  readonly trip = input.required<Trip>();
  /** Undefined until the first request starts. */
  readonly detail = input<RowDetail | undefined>(undefined);
  readonly retry = output<void>();
  readonly deleteRequested = output<void>();

  protected readonly comparison = computed(() => {
    const state = this.detail();
    return state?.status === 'ready' ? state.comparison : null;
  });
  protected readonly failure = computed(() => {
    const state = this.detail();
    return state?.status === 'error' ? { error: state.error } : null;
  });
  /** Each leg with its recommended option, if any. */
  protected readonly legs = computed(
    () =>
      this.comparison()?.legs.map((leg) => ({
        leg,
        best: leg.options.find((option): option is ModeOption => option.recommended) ?? null,
      })) ?? [],
  );

  protected readonly modeLabels = MODE_LABELS;
  protected readonly durationLabel = durationLabel;

  /** E.g. "Rain, 4 to 9 °C": the API's description and temperature range. */
  protected weatherLine(item: WeatherSummary): string {
    if (item.temperatureMinC === null || item.temperatureMaxC === null) {
      return item.description;
    }
    return `${item.description}, ${Math.round(item.temperatureMinC)} to ${Math.round(item.temperatureMaxC)} °C`;
  }
}
