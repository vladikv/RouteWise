import { ModeOption, TransportModeCode } from '../../../core/api/models';

export type Metric = 'score' | 'time' | 'cost' | 'co2';

export interface MetricDefinition {
  id: Metric;
  label: string;
  /** What a longer bar means, so the chart reads without a legend. */
  hint: string;
  /** Names the best mode's bar ("Fastest"). */
  bestLabel: string;
  /** Which end of the scale is best: the highest score, the lowest time, cost and CO₂. */
  best: 'max' | 'min';
}

export const METRICS: MetricDefinition[] = [
  { id: 'score', label: 'Score', hint: 'Higher is better', bestLabel: 'Best score', best: 'max' },
  { id: 'time', label: 'Time', hint: 'Shorter is better', bestLabel: 'Fastest', best: 'min' },
  { id: 'cost', label: 'Cost', hint: 'Lower is better', bestLabel: 'Cheapest', best: 'min' },
  { id: 'co2', label: 'CO₂', hint: 'Lower is better', bestLabel: 'Lowest CO₂', best: 'min' },
];

export function metricDefinition(metric: Metric): MetricDefinition {
  return METRICS.find((definition) => definition.id === metric) ?? METRICS[0];
}

export function metricValue(option: ModeOption, metric: Metric): number {
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

/** The available modes, best first for the metric; ties keep their given order. */
export function sortByMetric(options: ModeOption[], metric: Metric): ModeOption[] {
  const sign = metricDefinition(metric).best === 'max' ? -1 : 1;
  return options
    .filter((option) => option.available)
    .sort((a, b) => sign * (metricValue(a, metric) - metricValue(b, metric)));
}

/** Every available mode with the best value of the metric (several when they tie). */
export function bestModes(options: ModeOption[], metric: Metric): Set<TransportModeCode> {
  const sorted = sortByMetric(options, metric);
  if (sorted.length === 0) {
    return new Set();
  }
  const best = metricValue(sorted[0], metric);
  return new Set(
    sorted.filter((option) => metricValue(option, metric) === best).map(({ mode }) => mode),
  );
}
