import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Comparison, ModeOption } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { MODE_LABELS, durationLabel } from '../../../shared/util/labels';
import { comparisonInsight } from './comparison-insight';

type Metric = 'score' | 'time' | 'cost' | 'co2';

interface MetricOption {
  id: Metric;
  label: string;
  /** What a longer bar means, so the chart reads without a legend. */
  hint: string;
}

interface Row {
  option: ModeOption;
  /** Bar length as a share of the longest bar, 0–100. */
  percent: number;
  /** All four metrics in one line, for the hover tooltip. */
  tooltip: string;
}

const METRICS: MetricOption[] = [
  { id: 'score', label: 'Score', hint: 'Higher is better' },
  { id: 'time', label: 'Time', hint: 'Shorter is better' },
  { id: 'cost', label: 'Cost', hint: 'Lower is better' },
  { id: 'co2', label: 'CO₂', hint: 'Lower is better' },
];

let nextId = 0;

/**
 * Bar chart of one comparison metric at a time, best mode first. The recommended
 * mode is the single accent bar; its badge says so in words. Exact numbers for
 * every metric stay available in the comparison table.
 */
@Component({
  selector: 'app-comparison-chart',
  imports: [CurrencyPipe, DecimalPipe, ModeIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comparison-chart.html',
  styleUrl: './comparison-chart.scss',
})
export class ComparisonChart {
  readonly comparison = input.required<Comparison>();

  protected readonly metrics = METRICS;
  protected readonly metric = signal<Metric>('score');
  protected readonly metricHint = computed(
    () => METRICS.find((option) => option.id === this.metric())?.hint ?? '',
  );
  /** Radio group name, unique per chart so two charts on a page stay independent. */
  protected readonly groupName = `comparison-metric-${nextId++}`;
  protected readonly modeLabels = MODE_LABELS;
  protected readonly durationLabel = durationLabel;

  protected readonly insight = computed(() => comparisonInsight(this.comparison()));

  protected readonly rows = computed<Row[]>(() => {
    const metric = this.metric();
    const currency = this.comparison().currency;
    const available = this.comparison().options.filter((option) => option.available);
    const longest = Math.max(...available.map((option) => value(option, metric)), 0);
    return available
      .slice()
      .sort((a, b) =>
        metric === 'score'
          ? value(b, metric) - value(a, metric)
          : value(a, metric) - value(b, metric),
      )
      .map((option) => ({
        option,
        percent: longest > 0 ? (value(option, metric) / longest) * 100 : 0,
        tooltip: tooltip(option, currency),
      }));
  });

  protected readonly unavailable = computed(() =>
    this.comparison().options.filter((option) => !option.available),
  );
}

function value(option: ModeOption, metric: Metric): number {
  switch (metric) {
    case 'time':
      return option.durationMinutes ?? 0;
    case 'cost':
      return option.totalCost ?? 0;
    case 'co2':
      return option.co2Kg ?? 0;
    default:
      return option.score;
  }
}

function tooltip(option: ModeOption, currency: string): string {
  const money = new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    option.totalCost ?? 0,
  );
  return `${MODE_LABELS[option.mode]}: ${durationLabel(option.durationMinutes ?? 0)} · ${money} · ${(option.co2Kg ?? 0).toFixed(1)} kg CO₂ · score ${option.score}`;
}
