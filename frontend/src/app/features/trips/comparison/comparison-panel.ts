import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LegComparison } from './leg-comparison';
import {
  HAZARD_LABELS,
  MODE_LABELS,
  PRIORITY_LABELS,
  durationLabel,
  travelersLabel,
} from '../../../shared/util/labels';

/** Mode comparison for one leg (a whole A → B trip): time, cost and CO₂ side by side, plus the weather used. */
@Component({
  selector: 'app-comparison-panel',
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparison-panel.html',
  styleUrl: './comparison-panel.scss',
})
export class ComparisonPanel {
  readonly comparison = input.required<LegComparison>();

  protected readonly modeLabels = MODE_LABELS;
  protected readonly hazardLabels = HAZARD_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly durationLabel = durationLabel;
  protected readonly travelersLabel = travelersLabel;
}
