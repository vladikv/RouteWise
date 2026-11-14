import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Advice, ItineraryTotals } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { StatChip } from '../../../shared/ui/stat-chip';
import { MODE_LABELS, durationLabel } from '../../../shared/util/labels';
import { LegHover, LegMapToggle } from './leg-focus';

/**
 * The advisor's explanation of the recommendation, and who wrote it. The plan's key figures come
 * first (from the comparison, when it has arrived), then the summary, one row per leg (mode icon and
 * the advisor's sentence, linked to the map) and the tips. The advisor's text is shown as written.
 */
@Component({
  selector: 'app-advice-panel',
  imports: [CurrencyPipe, DecimalPipe, LegHover, LegMapToggle, ModeIcon, StatChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './advice-panel.html',
  styleUrl: './advice-panel.scss',
})
export class AdvicePanel {
  readonly advice = input.required<Advice>();
  /** Totals of the recommended plan; no figures row without them. */
  readonly figures = input<ItineraryTotals | null>(null);
  readonly currency = input('EUR');

  protected readonly modeLabels = MODE_LABELS;
  protected readonly durationLabel = durationLabel;
}
