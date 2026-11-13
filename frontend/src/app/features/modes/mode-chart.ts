import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TransportMode } from '../../core/api/models';
import { ModeIcon } from '../../shared/ui/mode-icon';
import { TabOption, Tabs } from '../../shared/ui/tabs';
import { MODE_LABELS } from '../../shared/util/labels';

type Metric = 'speed' | 'cost' | 'co2' | 'distance';

interface MetricDefinition {
  id: Metric;
  label: string;
  /** What a longer bar means, so the chart reads without a legend. */
  hint: string;
  /** Which end of the scale is best: the highest value (speed, range) or the lowest (cost, CO₂). */
  best: 'max' | 'min';
  /** Says why the best mode is best, for the text line under the tabs ("Plane is the fastest"). */
  bestText: { one: string; many: string };
  value: (mode: TransportMode) => number;
  format: (value: number) => string;
}

const count = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const METRICS: MetricDefinition[] = [
  {
    id: 'speed',
    label: 'Speed',
    hint: 'Longer is faster',
    best: 'max',
    bestText: { one: 'is the fastest', many: 'are the fastest' },
    value: (mode) => mode.avgSpeedKmh,
    format: (value) => `${count.format(value)} km/h`,
  },
  {
    id: 'cost',
    label: 'Cost',
    hint: 'Longer is more expensive per km',
    best: 'min',
    bestText: { one: 'is the cheapest per km', many: 'are the cheapest per km' },
    value: (mode) => mode.costPerKm,
    format: (value) => money.format(value),
  },
  {
    id: 'co2',
    label: 'CO₂',
    hint: 'Longer is more CO₂ per km',
    best: 'min',
    bestText: { one: 'has the lowest CO₂ per km', many: 'have the lowest CO₂ per km' },
    value: (mode) => mode.co2GramsPerKm,
    format: (value) => `${count.format(value)} g`,
  },
  {
    id: 'distance',
    label: 'Max. distance',
    hint: 'Longer reaches farther',
    best: 'max',
    bestText: { one: 'has the longest range', many: 'have the longest range' },
    value: (mode) => mode.maxDistanceKm,
    format: (value) => `${count.format(value)} km`,
  },
];

let nextId = 0;

/**
 * Horizontal bars of one mode parameter at a time (chosen with tabs), every bar proportional to the
 * largest shown value. The best mode for the shown parameter (fastest, cheapest, lowest CO₂, longest
 * range) is the accent bar and is also named in text. The table below lists all parameters as text.
 */
@Component({
  selector: 'app-mode-chart',
  imports: [ModeIcon, Tabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mode-chart.html',
  styleUrl: './mode-chart.scss',
})
export class ModeChart {
  readonly modes = input.required<TransportMode[]>();

  protected readonly tabs: TabOption<Metric>[] = METRICS.map(({ id, label }) => ({
    value: id,
    label,
  }));
  protected readonly metric = signal<Metric>('speed');
  protected readonly tabsId = `mode-metric-${nextId++}`;
  protected readonly labels = MODE_LABELS;
  protected readonly columns = METRICS;

  protected readonly definition = computed(
    () => METRICS.find(({ id }) => id === this.metric()) ?? METRICS[0],
  );

  /** The best value of the shown parameter; every mode that has it is best. */
  private readonly bestValue = computed(() => {
    const { value, best } = this.definition();
    const values = this.modes().map(value);
    return best === 'max' ? Math.max(...values) : Math.min(...values);
  });

  protected readonly rows = computed(() => {
    const { value, format } = this.definition();
    const modes = this.modes();
    const largest = Math.max(...modes.map(value), 0);
    const best = this.bestValue();
    return modes.map((mode) => ({
      mode,
      percent: largest > 0 ? (value(mode) / largest) * 100 : 0,
      text: format(value(mode)),
      best: value(mode) === best,
    }));
  });

  /** "Plane is the fastest": the best mode in words (several names when they tie). */
  protected readonly bestSummary = computed(() => {
    const names = this.rows()
      .filter(({ best }) => best)
      .map(({ mode }) => MODE_LABELS[mode.code]);
    if (names.length === 0) {
      return '';
    }
    const { one, many } = this.definition().bestText;
    return `${names.join(' and ')} ${names.length > 1 ? many : one}`;
  });

  protected readonly table = computed(() =>
    this.modes().map((mode) => ({
      mode,
      cells: METRICS.map(({ value, format }) => format(value(mode))),
    })),
  );
}
