import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModeOption } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { TabOption, Tabs } from '../../../shared/ui/tabs';
import { MODE_LABELS, PRIORITY_LABELS, durationLabel } from '../../../shared/util/labels';
import { comparisonInsight } from './comparison-insight';
import {
  METRICS,
  Metric,
  bestModes,
  metricDefinition,
  metricValue,
  sortByMetric,
} from './comparison-metric';
import { ADD_STOP_HINT, LegComparison } from './leg-comparison';

interface Row {
  option: ModeOption;
  /** Bar length in percent of the track: the score itself (100 = full) or a share of the longest bar. */
  percent: number;
  /** Best for the shown metric: the accent bar. */
  best: boolean;
  /** All four metrics in one line, for the hover tooltip. */
  tooltip: string;
}

let nextId = 0;

/**
 * Bar chart of one comparison metric at a time (chosen with tabs), best mode first. The best mode for
 * the shown metric is the accent bar and is named in words ("Fastest"); the recommended mode keeps its
 * badge on every tab. Exact numbers for every metric stay available in the comparison table.
 *
 * The line under the chart names the priority behind the recommendation. With `priorityLink` it links
 * there (the trip's edit page); otherwise it is a button that emits `priorityEdit` (Home focuses its
 * priority picker).
 */
@Component({
  selector: 'app-comparison-chart',
  imports: [CurrencyPipe, DecimalPipe, ModeIcon, RouterLink, Tabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparison-chart.html',
  styleUrl: './comparison-chart.scss',
})
export class ComparisonChart {
  readonly comparison = input.required<LegComparison>();
  readonly priorityLink = input<string | null>(null);
  readonly priorityEdit = output<void>();

  protected readonly metrics: TabOption<Metric>[] = METRICS.map(({ id, label }) => ({
    value: id,
    label,
  }));
  protected readonly metric = signal<Metric>('score');
  protected readonly definition = computed(() => metricDefinition(this.metric()));
  /** Tab and panel id prefix, unique per chart so two charts on a page stay independent. */
  protected readonly tabsId = `comparison-metric-${nextId++}`;
  protected readonly modeLabels = MODE_LABELS;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly durationLabel = durationLabel;
  protected readonly addStopHint = ADD_STOP_HINT;

  protected readonly insight = computed(() => comparisonInsight(this.comparison()));

  protected readonly rows = computed<Row[]>(() => {
    const metric = this.metric();
    const { currency, options } = this.comparison();
    const sorted = sortByMetric(options, metric);
    const best = bestModes(options, metric);
    const longest = Math.max(...sorted.map((option) => metricValue(option, metric)), 0);
    return sorted.map((option) => ({
      option,
      percent:
        metric === 'score'
          ? clampPercent(option.score)
          : longest > 0
            ? (metricValue(option, metric) / longest) * 100
            : 0,
      best: best.has(option.mode),
      tooltip: tooltip(option, currency),
    }));
  });

  protected readonly unavailable = computed(() => this.comparison().unavailableGroups);
}

function clampPercent(score: number): number {
  return Math.min(Math.max(score, 0), 100);
}

function tooltip(option: ModeOption, currency: string): string {
  const money = new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    option.totalCost ?? 0,
  );
  return `${MODE_LABELS[option.mode]}: ${durationLabel(option.durationMinutes ?? 0)} · ${money} · ${(option.co2Kg ?? 0).toFixed(1)} kg CO₂ · score ${option.score}`;
}
