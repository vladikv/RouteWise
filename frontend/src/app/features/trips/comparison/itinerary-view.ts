import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Comparison, Leg } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import {
  HAZARD_LABELS,
  MODE_LABELS,
  PRIORITY_LABELS,
  durationLabel,
  travelersLabel,
  unavailableDetail,
  unavailableTotalsText,
} from '../../../shared/util/labels';
import { ComparisonChart } from './comparison-chart';
import { ComparisonPanel } from './comparison-panel';
import { LegComparison, legComparison } from './leg-comparison';

/**
 * A multi-stop route: a timeline of legs with each leg's recommended mode, the
 * totals of that mixed plan against using one mode throughout, and every leg's
 * full comparison on demand.
 */
@Component({
  selector: 'app-itinerary-view',
  imports: [ComparisonChart, ComparisonPanel, CurrencyPipe, DatePipe, DecimalPipe, ModeIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './itinerary-view.html',
  styleUrl: './itinerary-view.scss',
})
export class ItineraryView {
  readonly comparison = input.required<Comparison>();

  protected readonly modeLabels = MODE_LABELS;
  protected readonly hazardLabels = HAZARD_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly durationLabel = durationLabel;
  protected readonly travelersLabel = travelersLabel;
  protected readonly unavailableTotalsText = unavailableTotalsText;

  /** Each leg with its recommended option, if any. */
  protected readonly legs = computed(() =>
    this.comparison().legs.map((leg) => ({
      leg,
      best: leg.options.find((option) => option.recommended) ?? null,
      reasons: leg.options
        .filter((option) => !option.available)
        .map(
          (option) =>
            `${MODE_LABELS[option.mode]}: ${unavailableDetail(option.unavailableCode, option.unavailableReason)}`,
        ),
    })),
  );

  /** Single-mode plans other than the recommended plan itself (when that uses one mode). */
  protected readonly alternatives = computed(() => {
    const planModes = this.comparison().recommendedItinerary?.modes ?? [];
    return this.comparison().singleModeTotals.filter(
      (totals) => !(planModes.length > 0 && planModes.every((mode) => mode === totals.mode)),
    );
  });

  /** E.g. "Train, then bus" or "Bus all the way". */
  protected readonly planName = computed(() => {
    const modes = this.comparison().recommendedItinerary?.modes ?? [];
    if (modes.length === 0) {
      return '';
    }
    const names = modes.map((mode) => MODE_LABELS[mode].toLowerCase());
    const phrase = new Set(modes).size === 1 ? `${names[0]} all the way` : names.join(', then ');
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  });

  protected legDetails(leg: Leg): LegComparison {
    return legComparison(this.comparison(), leg.index);
  }
}
